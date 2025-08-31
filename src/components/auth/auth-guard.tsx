"use client"
import { useEffect, useState } from "react"
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

const isDevelopment = () => {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("vercel.app") ||
      process.env.NODE_ENV === "development")
  )
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("")
  const router = useRouter()
  let hasRedirected = false

  useEffect(() => {
    const checkAuth = async () => {
      if (hasRedirected) return

      try {
        if (isDevelopment()) {
          console.log("[v0] ========== AUTH GUARD CHECK STARTED ==========")
          console.log("[v0] Current URL:", window.location.href)
          console.log("[v0] Required role:", requiredRole)
        }

        const userData = localStorage.getItem("userData")
        const authToken = document.cookie
          .split("; ")
          .find((row) => row.startsWith("authToken="))
          ?.split("=")[1]

        if (isDevelopment()) {
          console.log("[v0] Raw userData from localStorage:", userData)
          console.log("[v0] Raw authToken from cookie:", authToken)
          console.log("[v0] userData exists:", !!userData)
          console.log("[v0] authToken exists:", !!authToken)
          console.log("[v0] userData type:", typeof userData)
          console.log("[v0] authToken type:", typeof authToken)
        }

        if (!userData || !authToken) {
          if (isDevelopment()) {
            console.log("[v0] ❌ No auth data found, redirecting to login")
            console.log("[v0] Missing userData:", !userData)
            console.log("[v0] Missing authToken:", !authToken)
          }
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          localStorage.removeItem("userData")
          hasRedirected = true
          if (isDevelopment()) {
            console.log("[v0] Redirecting to /")
          }
          router.replace("/")
          return
        }

        if (userData === "undefined" || userData === "null" || authToken === "undefined" || authToken === "null") {
          if (isDevelopment()) {
            console.log("[v0] ❌ Invalid auth data (undefined/null strings)")
            console.log("[v0] userData value:", userData)
            console.log("[v0] authToken value:", authToken)
          }
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          localStorage.removeItem("userData")
          hasRedirected = true
          router.replace("/")
          return
        }

        if (userData.trim() === "" || authToken.trim() === "") {
          if (isDevelopment()) {
            console.log("[v0] ❌ Empty auth data")
            console.log("[v0] userData length:", userData.length)
            console.log("[v0] authToken length:", authToken.length)
          }
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          localStorage.removeItem("userData")
          hasRedirected = true
          router.replace("/")
          return
        }

        if (isDevelopment()) {
          console.log("[v0] Step 1: Auth data validation passed")
          console.log("[v0] Step 2: Calling token verification API...")
        }

        const verifyResponse = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: authToken }),
        })

        if (isDevelopment()) {
          console.log("[v0] Verify API response status:", verifyResponse.status)
          console.log("[v0] Verify API response ok:", verifyResponse.ok)
        }

        if (!verifyResponse.ok) {
          if (isDevelopment()) {
            console.log("[v0] ❌ Token verification failed")
            const errorText = await verifyResponse.text()
            console.log("[v0] Verify API error response:", errorText)
          }
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          localStorage.removeItem("userData")
          hasRedirected = true
          router.replace("/")
          return
        }

        const { user: verifiedUser } = await verifyResponse.json()
        if (isDevelopment()) {
          console.log("[v0] Step 3: Token verified successfully")
          console.log("[v0] Verified user:", verifiedUser)
        }

        let user: UserData
        try {
          user = JSON.parse(userData)
          if (isDevelopment()) {
            console.log("[v0] Step 4: Successfully parsed user data")
            console.log("[v0] Parsed user:", user)
          }
        } catch (parseError) {
          if (isDevelopment()) {
            console.error("[v0] ❌ Failed to parse userData:", parseError)
            console.error("[v0] userData value that failed to parse:", userData)
          }
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          localStorage.removeItem("userData")
          hasRedirected = true
          router.replace("/")
          return
        }

        if (!user || typeof user !== "object" || !user.email || !user.rol) {
          if (isDevelopment()) {
            console.log("[v0] ❌ Invalid user object structure")
            console.log("[v0] User object:", user)
            console.log("[v0] Has email:", !!user?.email)
            console.log("[v0] Has rol:", !!user?.rol)
          }
          document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
          localStorage.removeItem("userData")
          hasRedirected = true
          router.replace("/")
          return
        }

        if (requiredRole && user.rol !== requiredRole && user.rol !== "administrador") {
          if (isDevelopment()) {
            console.log("[v0] ❌ Insufficient permissions")
            console.log("[v0] Required role:", requiredRole)
            console.log("[v0] User role:", user.rol)
          }
          hasRedirected = true
          router.replace("/")
          return
        }

        if (isDevelopment()) {
          console.log("[v0] ✅ Auth check successful!")
          console.log("[v0] User email:", user.email)
          console.log("[v0] User role:", user.rol)
          console.log("[v0] ========== AUTH GUARD CHECK COMPLETED ==========")
        }
        setUserRole(user.rol)
        setIsAuthenticated(true)
      } catch (error) {
        if (isDevelopment()) {
          console.error("[v0] ========== AUTH GUARD ERROR ==========")
          console.error("[v0] Auth check error:", error)
        }
        document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
        localStorage.removeItem("userData")
        hasRedirected = true
        router.replace("/")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, requiredRole])

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
