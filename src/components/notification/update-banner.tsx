"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Download, RefreshCw } from "lucide-react"

interface UpdateBannerProps {
  onInstall?: () => void
  onUpdate?: () => void
  onDismiss?: () => void
}

export function UpdateBanner({ onInstall, onUpdate, onDismiss }: UpdateBannerProps) {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    console.log("[v0] UpdateBanner mounted, checking install availability")

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("[v0] beforeinstallprompt event received")
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }

    // Listen for service worker updates
    const handleServiceWorkerUpdate = (event: MessageEvent) => {
      if (event.data && event.data.type === "SW_UPDATED") {
        setShowUpdatePrompt(true)
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerUpdate)

    // Check if app is already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    const isInWebAppiOS = (window.navigator as any).standalone === true
    const isInstalled = isStandalone || isInWebAppiOS

    console.log("[v0] App installation status:", { isStandalone, isInWebAppiOS, isInstalled })

    if (isInstalled) {
      console.log("[v0] App is already installed, hiding install prompt")
      setShowInstallPrompt(false)
    } else {
      console.log("[v0] App not installed, checking for deferred prompt")
      // Check if we can show install prompt (some browsers support it without the event)
      setTimeout(() => {
        if (!deferredPrompt) {
          console.log("[v0] No deferred prompt available, but showing install option anyway")
          setShowInstallPrompt(true)
        }
      }, 1000)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerUpdate)
    }
  }, [])

  const handleInstall = async () => {
    console.log("[v0] Install button clicked, deferredPrompt:", !!deferredPrompt)

    if (!deferredPrompt) {
      console.log("[v0] No deferred prompt available, trying alternative methods")
      alert(
        "Para instalar esta aplicación:\n\n1. En Chrome: Menú > Instalar aplicación\n2. En Safari: Compartir > Añadir a pantalla de inicio\n3. En Firefox: Menú > Instalar",
      )
      return
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log("[v0] Install prompt result:", outcome)

      if (outcome === "accepted") {
        console.log("[v0] PWA installed successfully")
        onInstall?.()
      }

      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error("[v0] Error during installation:", error)
    }
  }

  const handleUpdate = async () => {
    setIsUpdating(true)

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" })
        window.location.reload()
      }
    }

    onUpdate?.()
    setShowUpdatePrompt(false)
    setIsUpdating(false)
  }

  const handleDismiss = (type: "install" | "update") => {
    console.log("[v0] Dismissing banner:", type)
    if (type === "install") {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    } else {
      setShowUpdatePrompt(false)
    }
    onDismiss?.()
  }

  console.log("[v0] UpdateBanner render state:", {
    showInstallPrompt,
    showUpdatePrompt,
    hasDeferredPrompt: !!deferredPrompt,
  })

  if (!showInstallPrompt && !showUpdatePrompt) {
    return null
  }

  return (
    <>
      {/* Install Banner */}
      {showInstallPrompt && (
        <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-primary/90 text-primary-foreground shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Download className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium truncate">Instalar Parking PWA</p>
                  <p className="text-xs opacity-90 truncate hidden sm:block">
                    {deferredPrompt
                      ? "Accede más rápido desde tu pantalla de inicio"
                      : "Ver instrucciones de instalación"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleInstall}
                  className="text-xs px-2 sm:px-3 py-1 sm:py-2 h-auto"
                >
                  <span className="hidden sm:inline">{deferredPrompt ? "Instalar" : "Cómo instalar"}</span>
                  <span className="sm:hidden">{deferredPrompt ? "Instalar" : "Info"}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss("install")}
                  className="text-primary-foreground hover:bg-primary-foreground/10 p-1 h-auto w-auto"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {showUpdatePrompt && (
        <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-blue-600/90 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium truncate">Nueva versión disponible</p>
                  <p className="text-xs opacity-90 truncate hidden sm:block">
                    Actualiza para obtener las últimas mejoras
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="text-xs px-2 sm:px-3 py-1 sm:py-2 h-auto"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      <span className="hidden sm:inline">Actualizando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <span>Actualizar</span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss("update")}
                  className="text-white hover:bg-white/10 p-1 h-auto w-auto"
                  disabled={isUpdating}
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
