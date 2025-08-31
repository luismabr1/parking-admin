// src/app/admin/admin-login.tsx
"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminLogin() {
  const router = useRouter()
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      console.log("[v0] ========== LOGIN PROCESS STARTED ==========")
      console.log("[v0] Current localStorage userData before clear:", localStorage.getItem("userData"))
      console.log(
        "[v0] Current authToken cookie before clear:",
        document.cookie.split("; ").find((row) => row.startsWith("authToken=")),
      )

      console.log("[v0] Step 1: Pre-login cleanup...")
      localStorage.removeItem("authToken")
      localStorage.removeItem("userData")
      document.cookie = "authToken=; Path=/; Max-Age=0; SameSite=Strict"
      document.cookie = "userData=; Path=/; Max-Age=0; SameSite=Strict"
      console.log("[v0] Pre-login cleanup completed")
      console.log("[v0] localStorage after cleanup - userData:", localStorage.getItem("userData"))
      console.log("[v0] localStorage after cleanup - authToken:", localStorage.getItem("authToken"))
      console.log("[v0] Cookies after cleanup:", document.cookie)

      console.log("[v0] Step 2: Making login API call...")
      console.log("[v0] Login credentials:", { username: credentials.username, password: "***" })

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      })

      console.log("[v0] API response status:", response.status)
      console.log("[v0] API response ok:", response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Login API error:", errorData)
        throw new Error(errorData.message || "Error de autenticación")
      }

      const data = await response.json()
      console.log("[v0] Step 3: Processing API response...")
      console.log("[v0] API response data:", {
        hasAuthToken: !!data.authToken,
        hasUserData: !!data.userData,
        userDataKeys: data.userData ? Object.keys(data.userData) : [],
        userData: data.userData,
      })

      // Validate userData
      if (!data.userData || typeof data.userData !== "object" || !data.userData.email || !data.userData.rol) {
        console.error("[v0] Invalid user data structure:", data.userData)
        throw new Error("Invalid user data received from server")
      }

      console.log("[v0] Step 4: Setting localStorage...")
      // Set localStorage and verify
      localStorage.setItem("authToken", data.authToken)
      localStorage.setItem("userData", JSON.stringify(data.userData))

      console.log("[v0] Stored authToken:", localStorage.getItem("authToken"))
      console.log("[v0] Stored userData:", localStorage.getItem("userData"))

      // Verify data was stored correctly
      const storedUserData = localStorage.getItem("userData")
      const storedAuthToken = localStorage.getItem("authToken")

      if (!storedUserData || !storedAuthToken) {
        console.error("[v0] Failed to store data in localStorage!")
        console.error("[v0] storedUserData:", storedUserData)
        console.error("[v0] storedAuthToken:", storedAuthToken)
        throw new Error("Failed to store authentication data")
      }

      try {
        const parsedUserData = JSON.parse(storedUserData)
        console.log("[v0] Successfully parsed stored userData:", parsedUserData)
      } catch (parseError) {
        console.error("[v0] Failed to parse stored userData:", parseError)
        throw new Error("Stored user data is corrupted")
      }

      console.log("[v0] Step 5: Preparing redirect...")
      // Ensure localStorage is updated before redirect
      await new Promise((resolve) => setTimeout(resolve, 100)) // Give more time for localStorage to persist

      console.log("[v0] Final verification before redirect:")
      console.log("[v0] Final localStorage userData:", localStorage.getItem("userData"))
      console.log("[v0] Final localStorage authToken:", localStorage.getItem("authToken"))

      console.log("[v0] Step 6: Redirecting to dashboard...")
      console.log("[v0] ========== LOGIN PROCESS COMPLETED ==========")
      router.push("/admin/dashboard")
    } catch (err) {
      console.error("[v0] ========== LOGIN ERROR ==========")
      console.error("[v0] Login error:", err)
      setError(err instanceof Error ? err.message : "Error de autenticación")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAccess = () => {
    if (process.env.NODE_ENV === "development") {
      localStorage.setItem("authToken", "demo-token")
      const demoUser = {
        _id: "demo",
        nombre: "Demo",
        apellido: "User",
        email: "demo@demo.com",
        rol: "administrador",
      }
      localStorage.setItem("userData", JSON.stringify(demoUser))
      router.push("/admin/dashboard")
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              type="text"
              placeholder="Nombre de usuario"
              value={credentials.username}
              onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
              className="h-12 text-lg"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Contraseña"
              value={credentials.password}
              onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
              className="h-12 text-lg"
              disabled={isLoading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
            {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>

          {process.env.NODE_ENV === "development" && (
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickAccess}
                className="w-full h-12 text-lg bg-transparent"
              >
                Acceso Rápido (Demo)
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
