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
  const [stats, setStats] = useState<DashboardStats>(() => getCachedStats() || initialStats)
  const [isLoading, setIsLoading] = useState(false)
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
    console.log("🔍 DEBUG: Cleanup executed")
  }, [])

  const updateStats = useCallback((newStats: DashboardStats) => {
    setStats(newStats)
    setCachedStats(newStats)
    setError(null)
    console.log("🔍 DEBUG: Stats updated:", newStats)
  }, [])

  const fetchInitialStats = useCallback(async () => {
    console.log("🔍 DEBUG: Starting fetchInitialStats, isLoading:", isLoading)
    setIsLoading(true)
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
        throw new Error(`Failed to fetch initial stats: ${response.statusText}`)
      }
    } catch (err) {
      console.error("🔍 DEBUG: Error fetching initial stats:", err)
      setError(err instanceof Error ? err.message : "Error fetching stats")
      const cached = getCachedStats()
      if (cached) {
        console.log("🔍 DEBUG: Using cached stats due to fetch error")
        setStats(cached)
      }
    } finally {
      setIsLoading(false)
      console.log("🔍 DEBUG: fetchInitialStats completed, isLoading:", isLoading)
    }
  }, [updateStats])

  const connectEventSource = useCallback(() => {
    cleanup()
    setIsConnected(false)
    console.log("🔍 DEBUG: Attempting to connect EventSource")
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
            console.log("🔍 DEBUG: Received heartbeat")
            return
          }
          if (data.error) {
            console.error("🔍 DEBUG: SSE error:", data.error)
            setError(data.error)
          } else {
            console.log("📊 Stats updated via SSE:", data)
            updateStats(data)
          }
        } catch (err) {
          console.error("🔍 DEBUG: Error parsing SSE data:", err)
        }
      }

      eventSource.onerror = () => {
        console.error("📡 SSE connection error")
        setIsConnected(false)
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000
          console.log(
            `🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
          )
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connectEventSource()
          }, delay)
        } else {
          setError("Connection lost. Using cached data.")
          const cached = getCachedStats()
          if (cached) {
            console.log("🔍 DEBUG: Using cached stats due to connection failure")
            setStats(cached)
          }
        }
      }
    } catch (err) {
      console.error("🔍 DEBUG: Error creating EventSource:", err)
      setError("Failed to establish real-time connection")
      setIsConnected(false)
      const cached = getCachedStats()
      if (cached) {
        console.log("🔍 DEBUG: Using cached stats due to EventSource error")
        setStats(cached)
      }
    }
  }, [cleanup, updateStats])

  const refetch = useCallback(async () => {
    console.log("🔍 DEBUG: Manual refetch triggered")
    await fetchInitialStats()
  }, [fetchInitialStats])

  useEffect(() => {
    const cached = getCachedStats()
    if (cached) {
      setStats(cached)
      console.log("🔍 DEBUG: Using cached stats on mount")
    }
    fetchInitialStats()
    connectEventSource()
    return cleanup
  }, [fetchInitialStats, connectEventSource, cleanup])

  useEffect(() => {
    if (!isConnected && reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log("🔄 SSE failed, falling back to polling")
      const interval = setInterval(() => {
        if (!isLoading) fetchInitialStats()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [isConnected, isLoading, fetchInitialStats])

  // Safeguard to ensure isLoading doesn't get stuck
  useEffect(() => {
    if (isLoading && isConnected && !error) {
      const timer = setTimeout(() => {
        console.log("🔍 DEBUG: isLoading stuck, forcing reset")
        setIsLoading(false)
      }, 5000) // Reset after 5 seconds if still loading with connection
      return () => clearTimeout(timer)
    }
  }, [isLoading, isConnected, error])

  return {
    stats,
    isLoading,
    isConnected,
    error,
    refetch,
  }
}