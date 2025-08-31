import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    console.log("[v0] Verifying token:", token ? "Token provided" : "No token")

    if (!token) {
      return NextResponse.json({ message: "Token requerido" }, { status: 400 })
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any
    console.log("[v0] Token verified for user:", decoded.email)

    // Return user data from token
    const user = {
      _id: decoded.userId,
      email: decoded.email,
      rol: decoded.rol,
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("[v0] Token verification failed:", error)
    return NextResponse.json({ message: "Token inválido" }, { status: 401 })
  }
}
