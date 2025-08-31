import { NextResponse } from "next/server"

export async function POST() {
  try {
    console.log("[v0] Processing logout request")

    // Clear the authToken cookie with proper attributes
    const response = NextResponse.json({ message: "Logout successful" })

    // Clear authToken cookie
    response.cookies.set("authToken", "", {
      path: "/",
      maxAge: 0,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // Allow client-side access for clearing
    })

    // Clear userData cookie if it exists
    response.cookies.set("userData", "", {
      path: "/",
      maxAge: 0,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    })

    console.log("[v0] Logout cookies cleared")
    return response
  } catch (error) {
    console.error("[v0] Error in logout:", error)
    return NextResponse.json({ message: "Error during logout" }, { status: 500 })
  }
}
