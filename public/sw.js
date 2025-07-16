const CACHE_NAME = "parking-admin-v1.0.0"
const STATIC_CACHE_URLS = ["/", "/admin/dashboard", "/manifest.json", "/offline.html"]

// Recursos dinámicos que se cachean bajo demanda
const DYNAMIC_CACHE_URLS = [
  "/api/admin/cars",
  "/api/admin/available-tickets",
  "/api/admin/stats",
  "/api/admin/pending-payments",
]

// Install event - cache static resources
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Installing...")
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("🔧 Service Worker: Caching static files")
        return cache.addAll(STATIC_CACHE_URLS)
      })
      .then(() => {
        console.log("✅ Service Worker: Installation complete")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("❌ Service Worker: Installation failed", error)
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🔧 Service Worker: Activating...")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("🗑️ Service Worker: Deleting old cache", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("✅ Service Worker: Activation complete")
        return self.clients.claim()
      }),
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) {
    return
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for caching
          const responseClone = response.clone()

          // Cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }

          return response
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Return offline page for failed API requests
            return new Response(
              JSON.stringify({
                error: "Sin conexión",
                message: "No hay conexión a internet",
              }),
              {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "Content-Type": "application/json" },
              },
            )
          })
        }),
    )
    return
  }

  // Handle page requests with cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone response for caching
          const responseClone = response.clone()

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })

          return response
        })
        .catch(() => {
          // Return offline page for failed page requests
          return caches.match("/offline.html").then((offlineResponse) => {
            return (
              offlineResponse ||
              new Response("<h1>Sin conexión</h1><p>No hay conexión a internet</p>", {
                headers: { "Content-Type": "text/html" },
              })
            )
          })
        })
    }),
  )
})

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("🔄 Service Worker: Background sync", event.tag)

  if (event.tag === "vehicle-registration") {
    event.waitUntil(syncVehicleRegistrations())
  }
})

// Push notifications
self.addEventListener("push", (event) => {
  console.log("🔔 Service Worker: Push received", event)

  const options = {
    body: event.data ? event.data.text() : "Nueva notificación del estacionamiento",
    icon: "/placeholder.svg?height=192&width=192",
    badge: "/placeholder.svg?height=72&width=72",
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Ver detalles",
        icon: "/placeholder.svg?height=128&width=128",
      },
      {
        action: "close",
        title: "Cerrar",
        icon: "/placeholder.svg?height=128&width=128",
      },
    ],
  }

  event.waitUntil(self.registration.showNotification("Parking Admin", options))
})

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Service Worker: Notification click", event)

  event.notification.close()

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/admin/dashboard"))
  }
})

// Helper function for syncing vehicle registrations
async function syncVehicleRegistrations() {
  try {
    // Get pending registrations from IndexedDB or localStorage
    const pendingRegistrations = JSON.parse(localStorage.getItem("pendingVehicleRegistrations") || "[]")

    for (const registration of pendingRegistrations) {
      try {
        const response = await fetch("/api/admin/cars", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registration),
        })

        if (response.ok) {
          // Remove from pending list
          const updatedPending = pendingRegistrations.filter((item) => item.id !== registration.id)
          localStorage.setItem("pendingVehicleRegistrations", JSON.stringify(updatedPending))
        }
      } catch (error) {
        console.error("❌ Failed to sync registration:", error)
      }
    }
  } catch (error) {
    console.error("❌ Background sync failed:", error)
  }
}
