"use client"

import { useState, useEffect } from "react"
import { API_BASE_URL } from "./config"

import WelcomeScreen from "./components/WelcomeScreen/WelcomeScreen"
import NameInputScreen from "./components/NameInputScreen/NameInputScreen"
import CreatePollScreen from "./components/CreatePollScreen/CreatePollScreen"
import TeacherDashboard from "./components/TeacherDashboard/TeacherDashboard"
import StudentWaitingScreen from "./components/StudentWaitingScreen/StudentWaitingScreen"
import StudentPollScreen from "./components/StudentPollScreen/StudentPollScreen"
import StudentResultsScreen from "./components/StudentResultsScreen/StudentResultsScreen"

import "./App.css"

function App() {
  const [currentScreen, setCurrentScreen] = useState("welcome")
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [userId, setUserId] = useState("")

  const [currentPoll, setCurrentPoll] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [hasVoted, setHasVoted] = useState(false)

  const [participants, setParticipants] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [timer, setTimer] = useState(60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const sessionId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setUserId(sessionId)
    console.log("🆔 User session created:", sessionId)
  }, [])

  useEffect(() => {
    if (
      currentScreen === "teacher-dashboard" ||
      currentScreen === "student-poll" ||
      currentScreen === "student-waiting" ||
      currentScreen === "student-results"
    ) {
      console.log("🔄 Starting real-time polling...")
      fetchActivePolls()

      const interval = setInterval(() => {
        fetchActivePolls()
        if (currentPoll?.id) {
          fetchParticipants()
          fetchChatMessages()
        }
      }, 2000)

      return () => {
        console.log("🛑 Stopping real-time polling...")
        clearInterval(interval)
      }
    }
  }, [currentScreen])

  useEffect(() => {
    if (isTimerRunning && timer > 0) {
      const timerInterval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timerInterval)
    }
  }, [isTimerRunning, timer])

  const fetchActivePolls = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/polls/active`)
      const data = await response.json()

      if (data.success && data.poll) {
        if (!currentPoll || currentPoll.id !== data.poll.id) {
          setCurrentPoll(data.poll)
          setTimer(data.poll.timeLimit || 60)
          console.log("📊 New poll received:", data.poll.question)
        }

        if (userRole === "student" && data.poll && !hasVoted && currentScreen === "student-waiting") {
          setCurrentScreen("student-poll")
        }
      } else if (userRole === "student" && currentScreen === "student-poll" && !data.poll) {
        setCurrentScreen("student-waiting")
        setSelectedOption(null)
        setHasVoted(false)
      }
    } catch (error) {
      console.error("❌ Failed to fetch active polls:", error)
    }
  }

  const fetchParticipants = async () => {
    if (!currentPoll?.id) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/participants?pollId=${currentPoll.id}`)
      const data = await response.json()
      if (data.success) {
        setParticipants(data.participants || [])
      }
    } catch (error) {
      console.error("❌ Failed to fetch participants:", error)
    }
  }

  const fetchChatMessages = async () => {
    if (!currentPoll?.id) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/messages?pollId=${currentPoll.id}`)
      const data = await response.json()
      if (data.success) {
        setChatMessages(data.messages || [])
      }
    } catch (error) {
      console.error("❌ Failed to fetch chat messages:", error)
    }
  }

  const createPoll = async (pollData) => {
    setIsLoading(true)
    try {
      console.log("🎯 Creating new poll:", pollData.question)
      console.log("⏰ Time limit:", pollData.timeLimit, "seconds")

      if (currentPoll?.id) {
        await fetch(`${API_BASE_URL}/api/polls/${currentPoll.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        })
      }

      const response = await fetch(`${API_BASE_URL}/api/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pollData,
          createdBy: userName,
          createdById: userId,
        }),
      })

      if (response.ok) {
        const newPoll = await response.json()
        setCurrentPoll(newPoll)
        setTimer(newPoll.timeLimit)
        setIsTimerRunning(true)
        setCurrentScreen("teacher-dashboard")
        setHasVoted(false)
        setSelectedOption(null)

        setTimeout(() => {
          joinPoll(newPoll.id)
        }, 500)

        console.log("✅ Poll created successfully!")
      }
    } catch (error) {
      console.error("❌ Failed to create poll:", error)
      alert("Failed to create poll. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const joinPoll = async (pollId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: pollId || currentPoll?.id,
          participant: {
            id: userId,
            name: userName,
            role: userRole,
          },
        }),
      })

      if (response.ok) {
        console.log("👥 Joined poll successfully")
        fetchParticipants()
      } else {
        const data = await response.json()
        if (data.kicked) {
          alert("You have been removed from this poll by the teacher.")
          setCurrentScreen("welcome")
        }
      }
    } catch (error) {
      console.error("❌ Failed to join poll:", error)
    }
  }

  const submitVote = async (optionIndex) => {
    setIsLoading(true)
    try {
      console.log(`🗳️ Submitting vote: Option ${optionIndex + 1}`)

      const response = await fetch(`${API_BASE_URL}/api/polls/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: currentPoll.id,
          optionIndex,
          userId,
          userName,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentPoll(data.poll)
        setHasVoted(true)
        setCurrentScreen("student-results")
        await joinPoll()
        console.log("✅ Vote submitted successfully!")
      } else {
        const data = await response.json()
        if (data.error.includes("removed from this poll")) {
          alert("You have been removed from this poll by the teacher.")
          setCurrentScreen("welcome")
        }
      }
    } catch (error) {
      console.error("❌ Failed to vote:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const kickParticipant = async (participantId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/participants/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, pollId: currentPoll.id }),
      })
      if (response.ok) {
        console.log("🚫 Participant kicked successfully")
        fetchParticipants()
      }
    } catch (error) {
      console.error("❌ Failed to kick participant:", error)
    }
  }

  const sendChatMessage = async (message) => {
    if (!message.trim()) return false
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: currentPoll.id,
          user: userName,
          message: message.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }),
      })
      if (response.ok) {
        console.log("💬 Message sent successfully")
        return true
      }
    } catch (error) {
      console.error("❌ Failed to send message:", error)
    }
    return false
  }

  const commonProps = {
    currentScreen,
    setCurrentScreen,
    userRole,
    setUserRole,
    userName,
    setUserName,
    userId,
    currentPoll,
    selectedOption,
    setSelectedOption,
    hasVoted,
    setHasVoted,
    participants,
    chatMessages,
    timer,
    isTimerRunning,
    setIsTimerRunning,
    isLoading,
    setIsLoading,
    createPoll,
    joinPoll,
    submitVote,
    kickParticipant,
    sendChatMessage,
    fetchActivePolls,
  }

  const renderScreen = () => {
    console.log("🎭 Current screen:", currentScreen)

    switch (currentScreen) {
      case "welcome":
        return <WelcomeScreen {...commonProps} />
      case "name-input":
        return <NameInputScreen {...commonProps} />
      case "create-poll":
        return <CreatePollScreen {...commonProps} />
      case "teacher-dashboard":
        return <TeacherDashboard {...commonProps} />
      case "student-waiting":
        return <StudentWaitingScreen {...commonProps} />
      case "student-poll":
        return <StudentPollScreen {...commonProps} />
      case "student-results":
        return <StudentResultsScreen {...commonProps} />
      default:
        return <WelcomeScreen {...commonProps} />
    }
  }

  return <div className="app">{renderScreen()}</div>
}

export default App
