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
  connectionStatus: "live" | "inactive" | "background"
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
const POLLING_INTERVAL_MS = 30000 // 30 seconds polling interval

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
  const [connectionStatus, setConnectionStatus] = useState<"live" | "inactive" | "background">("background")
  const [error, setError] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isTabActiveRef = useRef(true)

  const cleanup = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 DEBUG: Cleanup executed")
    }
  }, [])

  const updateStats = useCallback((newStats: DashboardStats) => {
    setStats(newStats)
    setCachedStats(newStats)
    setError(null)
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 DEBUG: Stats updated:", newStats)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 DEBUG: Starting fetchStats, isLoading:", isLoading)
    }
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
        throw new Error(`Failed to fetch stats: ${response.statusText}`)
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("🔍 DEBUG: Error fetching stats:", err)
      }
      setError(err instanceof Error ? err.message : "Error fetching stats")
      const cached = getCachedStats()
      if (cached) {
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: Using cached stats due to fetch error")
        }
        setStats(cached)
      }
    } finally {
      setIsLoading(false)
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 DEBUG: fetchStats completed, isLoading:", isLoading)
      }
    }
  }, [updateStats])

  const refetch = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 DEBUG: Manual refetch triggered")
    }
    await fetchStats()
  }, [fetchStats])

  useEffect(() => {
    const cached = getCachedStats()
    if (cached) {
      setStats(cached)
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 DEBUG: Using cached stats on mount")
      }
    }
    fetchStats()
    pollingIntervalRef.current = setInterval(() => {
      if (isTabActiveRef.current) {
        fetchStats()
      }
    }, POLLING_INTERVAL_MS)
    return cleanup
  }, [fetchStats, cleanup])

  useEffect(() => {
    const handleVisibility = () => {
      isTabActiveRef.current = document.visibilityState === "visible"
      if (!isTabActiveRef.current) {
        if (process.env.NODE_ENV === "development") {
          console.log("🔕 Tab inactive, pausing polling")
        }
        setConnectionStatus("background")
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("🔔 Tab active, resuming polling")
        }
        setConnectionStatus("live")
        fetchStats()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
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