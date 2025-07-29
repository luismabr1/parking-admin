// src/app/ClientLayout.tsx
"use client"

import * as React from "react"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import PWAInstallPrompt from "@/components/notification/pwa-install-prompt"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => console.log("Service Worker registered:", registration))
        .catch((error) => console.error("Service Worker registration failed:", error))
    }
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
      <PWAInstallPrompt />
    </ThemeProvider>
  )
}
