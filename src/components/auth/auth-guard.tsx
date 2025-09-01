"use client"
import { useEffect, useState, useRef } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

interface UserData {
  _id: string
  email: string
  rol: string
  nombre?: string
  apellido?: string
}

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string
}

let isAuthCheckInProgress = false
let authCheckPromise: Promise<boolean> | null = null
let instanceCounter = 0

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("")
  const router = useRouter()
  const isMountedRef = useRef(true)
  const instanceIdRef = useRef(++instanceCounter)

  useEffect(() => {
    isMountedRef.current = true
    const instanceId = instanceIdRef.current

    console.log(`[v0] AuthGuard Instance ${instanceId}: Starting useEffect`)

    const checkAuth = async (): Promise<boolean> => {
      if (isAuthCheckInProgress && authCheckPromise) {
        console.log(`[v0] AuthGuard Instance ${instanceId}: Auth check already in progress, waiting...`)
        return await authCheckPromise
      }

      console.log(`[v0] AuthGuard Instance ${instanceId}: Starting new auth check`)
      isAuthCheckInProgress = true
      authCheckPromise = performAuthCheck(instanceId)

      try {
        const result = await authCheckPromise
        return result
      } finally {
        isAuthCheckInProgress = false
        authCheckPromise = null
      }
    }

    const performAuthCheck = async (instanceId: number): Promise<boolean> => {
      try {
        console.log(`[v0] AuthGuard Instance ${instanceId}: Starting auth check...`)

        if (!isMountedRef.current) {
          console.log(`[v0] AuthGuard Instance ${instanceId}: Component unmounted, aborting check`)
          return false
        }

        const userData = localStorage.getItem("userData")
        console.log(`[v0] AuthGuard Instance ${instanceId}: Raw userData from localStorage:`, userData)

        if (!userData || userData === "null" || userData === "undefined" || userData.trim() === "") {
          console.log(`[v0] AuthGuard Instance ${instanceId}: No valid auth data found, redirecting to login`)

          if (isMountedRef.current) {
            localStorage.clear()
            document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
            router.replace("/")
          }
          return false
        }

        let user: UserData
        try {
          user = JSON.parse(userData)
          console.log(`[v0] AuthGuard Instance ${instanceId}: Parsed user data:`, user)
        } catch (parseError) {
          console.log(`[v0] AuthGuard Instance ${instanceId}: Failed to parse userData:`, parseError)

          if (isMountedRef.current) {
            localStorage.clear()
            document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
            router.replace("/")
          }
          return false
        }

        if (!user || typeof user !== "object" || !user.email || !user.rol || !user._id) {
          console.log(`[v0] AuthGuard Instance ${instanceId}: Missing required user fields:`, {
            hasEmail: !!user?.email,
            hasRol: !!user?.rol,
            hasId: !!user?._id,
          })

          if (isMountedRef.current) {
            localStorage.clear()
            document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
            router.replace("/")
          }
          return false
        }

        console.log(`[v0] AuthGuard Instance ${instanceId}: Auth validation successful for user:`, user.email)

        if (requiredRole && user.rol !== requiredRole && user.rol !== "administrador") {
          console.log(
            `[v0] AuthGuard Instance ${instanceId}: Insufficient permissions. Required:`,
            requiredRole,
            "User has:",
            user.rol,
          )

          if (isMountedRef.current) {
            router.replace("/")
          }
          return false
        }

        if (isMountedRef.current) {
          console.log(`[v0] AuthGuard Instance ${instanceId}: Setting authenticated state to true`)
          setUserRole(user.rol)
          setIsAuthenticated(true)
        }
        return true
      } catch (error) {
        console.error(`[v0] AuthGuard Instance ${instanceId}: Auth check error:`, error)

        if (isMountedRef.current) {
          localStorage.clear()
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          router.replace("/")
        }
        return false
      } finally {
        if (isMountedRef.current) {
          console.log(`[v0] AuthGuard Instance ${instanceId}: Setting loading to false`)
          setIsLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      console.log(`[v0] AuthGuard Instance ${instanceId}: Cleanup called`)
      isMountedRef.current = false
    }
  }, []) // Removed router and requiredRole from dependency array to prevent re-runs

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No estás autenticado. Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
