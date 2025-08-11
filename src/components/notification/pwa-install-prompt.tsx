"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Download, Smartphone } from "lucide-react"
import { useMobileDetection } from "@/hooks/use-mobile-detection"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const isMobile = useMobileDetection()

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Check if app is already installed or running in standalone mode
    const checkInstallStatus = () => {
      const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
      const isIOSStandalone = (window.navigator as any).standalone === true
      const isInstalled = isStandaloneMode || isIOSStandalone

      setIsStandalone(isStandaloneMode || isIOSStandalone)
      setIsInstalled(isInstalled)

      console.log("PWAInstallPrompt: Install status check:", {
        isStandaloneMode,
        isIOSStandalone,
        isInstalled,
      })
    }

    checkInstallStatus()

    const hasBeenDismissed = localStorage.getItem("pwa-install-dismissed")
    if (hasBeenDismissed) {
      console.log("PWAInstallPrompt: Install prompt has been permanently dismissed.")
      return
    }

    if (isIOSDevice && !isInstalled) {
      console.log("PWAInstallPrompt: iOS device detected. Scheduling banner show.")
      const timer = setTimeout(() => {
        setShowBanner(true)
        console.log("PWAInstallPrompt: iOS banner shown after delay.")
      }, 8000)
      return () => clearTimeout(timer)
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent
      console.log("PWAInstallPrompt: beforeinstallprompt event fired")

      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()

      // Save the event so it can be triggered later
      setDeferredPrompt(promptEvent)

      // Show the install banner after a delay if not installed
      if (!isInstalled) {
        setTimeout(() => {
          setShowBanner(true)
          console.log("PWAInstallPrompt: Showing banner after delay")
        }, 3000)
      }
    }

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log("PWAInstallPrompt: App was installed")
      setIsInstalled(true)
      setShowBanner(false)
      setDeferredPrompt(null)
      localStorage.removeItem("pwa-install-dismissed")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [isInstalled])

  const handleInstallClick = async () => {
    console.log("PWAInstallPrompt: Install button clicked.")
    if (!deferredPrompt && !isIOS) {
      console.log("PWAInstallPrompt: No deferred prompt available")
      return
    }

    if (deferredPrompt) {
      console.log("PWAInstallPrompt: Showing install prompt")

      try {
        // Show the install prompt
        deferredPrompt.prompt()

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice
        console.log("PWAInstallPrompt: User choice:", outcome)

        if (outcome === "accepted") {
          console.log("PWAInstallPrompt: User accepted the install prompt")
          setShowBanner(false)
        } else {
          console.log("PWAInstallPrompt: User dismissed the install prompt")
        }

        // Clear the deferred prompt
        setDeferredPrompt(null)
      } catch (error) {
        console.error("PWAInstallPrompt: Error during installation:", error)
      }
    }
  }

  const handleDismiss = () => {
    console.log("PWAInstallPrompt: Banner dismissed by user")
    setShowBanner(false)
  }

  const handleDismissPermanently = () => {
    console.log("PWAInstallPrompt: Dismiss permanently button clicked.")
    localStorage.setItem("pwa-install-dismissed", "true")
    setShowBanner(false)
  }

  // Don't show anything if app is already installed or running in standalone mode
  if (isInstalled || isStandalone) {
    console.log("PWAInstallPrompt: Not showing banner. isInstalled:", isInstalled, "isStandalone:", isStandalone)
    return null
  }

  // Don't show banner if conditions aren't met
  if (!showBanner) {
    console.log("PWAInstallPrompt: Not showing banner. showBanner:", showBanner, "deferredPrompt:", !!deferredPrompt)
    return null
  }

  console.log("PWAInstallPrompt: Rendering banner.")

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-full overflow-hidden">
        <div className="w-full bg-background/90 backdrop-blur-md border-t border-border shadow-lg p-3">
          <div className="space-y-3 w-full">
            <div className="flex items-center gap-3 w-full">
              <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {isIOS ? "Agregar a Inicio" : "Instalar App"}
                </p>
                <p className="text-xs text-foreground/70 break-words">
                  {isIOS ? "Toca Compartir → Agregar a pantalla de inicio" : "Acceso rápido y notificaciones"}
                </p>
              </div>

              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="p-1 h-8 w-8 flex-shrink-0 bg-transparent text-foreground hover:bg-foreground/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2 w-full">
              {!isIOS && deferredPrompt && (
                <Button
                  onClick={handleInstallClick}
                  size="sm"
                  className="flex-1 bg-foreground/10 border border-foreground/30 text-foreground hover:bg-foreground/20 text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Instalar
                </Button>
              )}

              <Button
                onClick={handleDismissPermanently}
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-foreground/50 hover:text-foreground bg-transparent border border-foreground/20 hover:border-foreground/30"
              >
                No mostrar más
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-border shadow-lg p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-foreground">{isIOS ? "Agregar a Inicio" : "Instalar App"}</p>
            <p className="text-sm text-foreground/70">
              {isIOS ? "Toca Compartir → Agregar a pantalla de inicio" : "Acceso rápido y notificaciones"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS && deferredPrompt && (
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="bg-foreground/10 border border-foreground/30 text-foreground hover:bg-foreground/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Instalar
              </Button>
            )}

            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="p-1 h-8 w-8 bg-transparent text-foreground hover:bg-foreground/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button
          onClick={handleDismissPermanently}
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-sm text-foreground/50 hover:text-foreground underline bg-transparent"
        >
          No mostrar más
        </Button>
      </div>
    </div>
  )
}
