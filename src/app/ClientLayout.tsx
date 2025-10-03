"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme/theme-provider"
import UpdatePrompt from "@/components/notification/update-prompt"
import PWAInstallPrompt from "@/components/notification/pwa-install-prompt"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [isClient, setIsClient] = useState(false)

   useEffect(() => {
    setIsClient(true)

    // Register service worker for PWA and push notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered successfully:", registration.scope)

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New service worker is available
                  console.log("New service worker available")
                }
              })
            }
          })
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error)
        })
    }
  }, [])
 
  if (!isClient) {
    return null
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <UpdatePrompt />
      <PWAInstallPrompt />
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
