"use client"

import type React from "react"

import { useEffect } from "react"
import PWAInstallPrompt from "@/components/notification/pwa-install-prompt"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered with scope:", registration.scope)
          })
          .catch((error) => {
            console.error("Service Worker registration failed:", error)
          })
      })
    }
  }, [])

  return (
    <>
      {children}
      <PWAInstallPrompt />
    </>
  )
}
