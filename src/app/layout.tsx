import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import  NotificationPrompt  from "@/components/notification/notification-prompt"
import  PWAInstallPrompt  from "@/components/notification/pwa-install-prompt"
import { getLogoSrc } from "@/config/app-config"

const inter = Inter({ subsets: ["latin"] })
const logoSrc = getLogoSrc()

export const metadata: Metadata = {
  title: "Parking Admin System",
  description: "Sistema de administración de estacionamiento móvil",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Parking Admin",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: logoSrc,
    apple: logoSrc,
    shortcut: logoSrc,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Parking Admin" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Parking Admin" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />

        <link rel="apple-touch-icon" href={logoSrc} />
        <link rel="icon" type="image/svg+xml" href={logoSrc} />
        <link rel="shortcut icon" href={logoSrc} />
        <link rel="manifest" href="/manifest.json" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:url" content="https://parking-admin.vercel.app" />
        <meta name="twitter:title" content="Parking Admin System" />
        <meta name="twitter:description" content="Sistema de administración de estacionamiento móvil" />
        <meta name="twitter:image" content={logoSrc} />
        <meta name="twitter:creator" content="@parkingadmin" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Parking Admin System" />
        <meta property="og:description" content="Sistema de administración de estacionamiento móvil" />
        <meta property="og:site_name" content="Parking Admin System" />
        <meta property="og:url" content="https://parking-admin.vercel.app" />
        <meta property="og:image" content={logoSrc} />
      </head>
      <body className={`${inter.className} safe-area-top safe-area-bottom`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <div className="min-h-screen bg-background">{children}</div>
          <Toaster />
          <NotificationPrompt />
          <PWAInstallPrompt />
        </ThemeProvider>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
              
              // Handle offline/online status
              function updateOnlineStatus() {
                if (navigator.onLine) {
                  document.body.classList.remove('offline');
                } else {
                  document.body.classList.add('offline');
                }
              }
              
              window.addEventListener('online', updateOnlineStatus);
              window.addEventListener('offline', updateOnlineStatus);
              updateOnlineStatus();
            `,
          }}
        />
      </body>
    </html>
  )
}
