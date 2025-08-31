import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Solo proteger rutas que empiecen con /admin
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // Verificar si hay token de autenticación en las cookies o headers
    const authToken = request.cookies.get("authToken")?.value
    const userDataCookie = request.cookies.get("userData")?.value

    // Si no hay token o userData, redirigir al login
    if (!authToken || !userDataCookie) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    try {
      // Verificar que userData sea válido JSON
      JSON.parse(userDataCookie)
    } catch (error) {
      // Si userData no es válido, redirigir al login
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
