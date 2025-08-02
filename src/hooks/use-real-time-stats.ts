"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface DashboardStats {
  pendingPayments: number
  totalStaff: number
  todayPayments: number
  totalTickets: number
  availableTickets: number
  carsParked: number
  paidTickets: number
  pendingConfirmations: number
}

interface UseRealTimeStatsReturn {
  stats: DashboardStats
  isLoading: boolean
  isConnected: boolean
  connectionStatus: "connected" | "disconnected" | "loading"
  error: string | null
  refetch: () => Promise<void>
}

const initialStats: DashboardStats = {
  pendingPayments: 0,
  totalStaff: 0,
  todayPayments: 0,
  totalTickets: 0,
  availableTickets: 0,
  carsParked: 0,
  paidTickets: 0,
  pendingConfirmations: 0,
}

const CACHE_KEY = "admin-dashboard-stats"
const CACHE_TIMESTAMP_KEY = "admin-dashboard-stats-timestamp"
const CACHE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

const getCachedStats = (): DashboardStats | null => {
  if (typeof window === "undefined") return null
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    if (!cached || !timestamp) return null
    const cacheAge = Date.now() - Number.parseInt(timestamp)
    if (cacheAge > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
      return null
    }
    return JSON.parse(cached)
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error reading cached stats:", error)
    }
    return null
  }
}

const setCachedStats = (stats: DashboardStats) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stats))
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error caching stats:", error)
    }
  }
}

export function useRealTimeStats(): UseRealTimeStatsReturn {
  const [stats, setStats] = useState<DashboardStats>(() => getCachedStats() || initialStats)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "loading">("loading")
  const [error, setError] = useState<string | null>(null)
  const eventListenerRef = useRef<(() => void) | null>(null)

  const updateStats = useCallback((newStats: DashboardStats) => {
    setStats(newStats)
    setCachedStats(newStats)
    setError(null)
    setIsConnected(true)
    setConnectionStatus("connected")
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Stats updated:", newStats)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Fetching stats...")
    }
    setIsLoading(true)
    setConnectionStatus("loading")

    try {
      const response = await fetch(`/api/admin/stats?t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (response.ok) {
        const data = await response.json()
        updateStats(data)
      } else {
        throw new Error(`Failed to fetch stats: ${response.statusText}`)
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching stats:", err)
      }
      setError(err instanceof Error ? err.message : "Error fetching stats")
      setIsConnected(false)
      setConnectionStatus("disconnected")

      // Use cached stats if available
      const cached = getCachedStats()
      if (cached) {
        if (process.env.NODE_ENV === "development") {
          console.log("📦 Using cached stats due to fetch error")
        }
        setStats(cached)
      }
    } finally {
      setIsLoading(false)
    }
  }, [updateStats])

  const refetch = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔄 Manual refetch triggered")
    }
    await fetchStats()
  }, [fetchStats])

  // Set up event listener for stats updates
  useEffect(() => {
    // Create event listener function
    const handleStatsUpdate = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("📊 Stats update event received, fetching new data...")
      }
      fetchStats()
    }

    // Store reference for cleanup
    eventListenerRef.current = handleStatsUpdate

    // Add custom event listener for stats updates
    window.addEventListener("statsUpdate", handleStatsUpdate)

    // Initial fetch
    const cached = getCachedStats()
    if (cached) {
      setStats(cached)
      setIsConnected(true)
      setConnectionStatus("connected")
      if (process.env.NODE_ENV === "development") {
        console.log("📦 Using cached stats on mount")
      }
    }

    // Always fetch fresh data on mount
    fetchStats()

    // Cleanup function
    return () => {
      if (eventListenerRef.current) {
        window.removeEventListener("statsUpdate", eventListenerRef.current)
        eventListenerRef.current = null
      }
    }
  }, [fetchStats])

  return {
    stats,
    isLoading,
    isConnected,
    connectionStatus,
    error,
    refetch,
  }
}
