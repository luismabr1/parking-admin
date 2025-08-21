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
    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
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
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallPrompt(false)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerUpdate)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      console.log("PWA installed")
      onInstall?.()
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
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
    if (type === "install") {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    } else {
      setShowUpdatePrompt(false)
    }
    onDismiss?.()
  }

  if (!showInstallPrompt && !showUpdatePrompt) {
    return null
  }

  return (
    <>
      {/* Install Banner */}
      {showInstallPrompt && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg">
          <div className="flex items-center justify-between p-3 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Download className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Instalar Parking PWA</p>
                <p className="text-xs opacity-90 truncate">Accede más rápido desde tu pantalla de inicio</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="secondary" onClick={handleInstall} className="text-xs">
                Instalar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss("install")}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {showUpdatePrompt && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg">
          <div className="flex items-center justify-between p-3 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <RefreshCw className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Nueva versión disponible</p>
                <p className="text-xs opacity-90 truncate">Actualiza para obtener las últimas mejoras</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="secondary" onClick={handleUpdate} disabled={isUpdating} className="text-xs">
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss("update")}
                className="text-white hover:bg-white/10"
                disabled={isUpdating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
