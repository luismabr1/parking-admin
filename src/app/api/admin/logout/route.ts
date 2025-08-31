// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Optional: Perform server-side cleanup (e.g., invalidate token in a database)
    console.log("[v0] Server-side logout processed");

    // Clear the authToken cookie
    return NextResponse.json({ message: "Logout successful" }, {
      headers: {
        "Set-Cookie": `authToken=; Path=/; Max-Age=0; SameSite=Strict; Secure`,
      },
    });
  } catch (error) {
    console.error("[v0] Error in logout:", error);
    return NextResponse.json({ message: "Error during logout" }, { status: 500 });
  }
}