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
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// Helper functions for localStorage
const getCachedStats = (): DashboardStats | null => {
  if (typeof window === "undefined") return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    if (!cached || !timestamp) return null

    const cacheAge = Date.now() - Number.parseInt(timestamp)
    if (cacheAge > CACHE_EXPIRY_MS) {
      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
      return null
    }

    return JSON.parse(cached)
  } catch (error) {
    console.error("Error reading cached stats:", error)
    return null
  }
}

const setCachedStats = (stats: DashboardStats) => {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stats))
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.error("Error caching stats:", error)
  }
}

export function useRealTimeStats(): UseRealTimeStatsReturn {
  // Initialize with cached stats if available
  const [stats, setStats] = useState<DashboardStats>(() => {
    const cached = getCachedStats()
    return cached || initialStats
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const updateStats = useCallback((newStats: DashboardStats) => {
    setStats(newStats)
    setCachedStats(newStats) // Cache the new stats
    setError(null)
  }, [])

  const fetchInitialStats = useCallback(async () => {
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
        throw new Error("Failed to fetch initial stats")
      }
    } catch (err) {
      console.error("Error fetching initial stats:", err)
      setError(err instanceof Error ? err.message : "Error fetching stats")

      // If we have cached stats, keep using them
      const cached = getCachedStats()
      if (cached) {
        console.log("Using cached stats due to fetch error")
        setStats(cached)
      }
    } finally {
      setIsLoading(false)
    }
  }, [updateStats])

  const connectEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      cleanup()
    }

    try {
      const eventSource = new EventSource("/api/admin/stats-stream")
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log("📡 SSE connection opened")
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.heartbeat) {
            // Just a heartbeat, don't update stats
            return
          }

          if (data.error) {
            console.error("SSE error:", data.error)
            setError(data.error)
          } else {
            console.log("📊 Stats updated via SSE:", data)
            updateStats(data)
          }
        } catch (err) {
          console.error("Error parsing SSE data:", err)
        }
      }

      eventSource.onerror = (event) => {
        console.error("📡 SSE connection error:", event)
        setIsConnected(false)

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000 // 1s, 2s, 4s, 8s, 16s
          console.log(
            `🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`,
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connectEventSource()
          }, delay)
        } else {
          setError("Connection lost. Using cached data.")

          // Keep using cached stats if available
          const cached = getCachedStats()
          if (cached) {
            console.log("Using cached stats due to connection failure")
            setStats(cached)
          }
        }
      }
    } catch (err) {
      console.error("Error creating EventSource:", err)
      setError("Failed to establish real-time connection")
      setIsConnected(false)

      // Use cached stats if available
      const cached = getCachedStats()
      if (cached) {
        console.log("Using cached stats due to EventSource error")
        setStats(cached)
      }
    }
  }, [cleanup, updateStats])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    await fetchInitialStats()
  }, [fetchInitialStats])

  useEffect(() => {
    // Check if we have cached stats
    const cached = getCachedStats()
    if (cached) {
      console.log("📦 Using cached stats on mount")
      setStats(cached)
      setIsLoading(false)
    }

    // Fetch initial stats (this will update cache if successful)
    fetchInitialStats()

    // Connect to SSE for real-time updates
    connectEventSource()

    // Cleanup on unmount
    return cleanup
  }, [fetchInitialStats, connectEventSource, cleanup])

  // Fallback polling if SSE fails
  useEffect(() => {
    if (!isConnected && !isLoading && reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log("🔄 SSE failed, falling back to polling")
      const interval = setInterval(fetchInitialStats, 30000)
      return () => clearInterval(interval)
    }
  }, [isConnected, isLoading, fetchInitialStats])

  return {
    stats,
    isLoading,
    isConnected,
    error,
    refetch,
  }
}
