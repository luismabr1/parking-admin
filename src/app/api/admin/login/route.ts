import { type NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    console.log("[v0] Login attempt for:", username);

    if (!username || !password) {
      return NextResponse.json({ message: "Usuario y contraseña son requeridos" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("parking");

    const user = await db.collection("staff").findOne({
      email: username,
    });

    console.log("[v0] User found:", user ? "Yes" : "No");
    console.log("[v0] User has password:", user?.password ? "Yes" : "No");

    if (!user) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    if (!user.password) {
      console.log("[v0] User has no password set");
      return NextResponse.json({ message: "Usuario sin contraseña configurada" }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log("[v0] Password valid:", isValidPassword);

    if (!isValidPassword) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    // Validate required fields
    if (!user.email || !user.rol) {
      console.log("[v0] Invalid user data: missing email or rol");
      return NextResponse.json({ message: "Datos de usuario incompletos" }, { status: 500 });
    }

    // Generate JWT token
    const authToken = jwt.sign(
      { userId: user._id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET || "your-secret-key", // Use a secure secret in .env
      { expiresIn: "1h" }
    );

    // Prepare user data (exclude sensitive fields)
    const userData = {
      _id: user._id.toString(), // Convert ObjectId to string
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      rol: user.rol,
    };

    console.log("[v0] Login successful for user:", userData.email);

    return NextResponse.json({
      authToken,
      userData,
    });
  } catch (error) {
    console.error("[v0] Error en login:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}