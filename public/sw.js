const CACHE_NAME = "parking-pwa-admin-v10" // Incrementar versión cuando hay cambios
const urlsToCache = ["/", "/manifest.json", "/offline.html"]

// Install event
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker instalando versión:", CACHE_NAME)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Cache abierto:", CACHE_NAME)
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("❌ Error agregando al cache:", error)
        return Promise.resolve()
      })
    }),
  )
  // No usar skipWaiting() automáticamente - esperar confirmación del usuario
  console.log("⏳ Service Worker instalado, esperando activación manual")
})

// Activate event
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activando versión:", CACHE_NAME)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Eliminando cache antiguo:", cacheName)
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  self.clients.claim()

  // Notificar a todos los clientes que el SW se ha actualizado
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "SW_UPDATED",
        version: CACHE_NAME,
      })
    })
  })
})

// Fetch event con estrategia mejorada
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }

  // Para archivos estáticos de Next.js (_next/static), usar cache first
  if (event.request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response
        }
        return fetch(event.request).then((response) => {
          // Solo cachear si la respuesta es válida
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
      }),
    )
    return
  }

  // Para páginas HTML, usar network first con fallback a cache
  if (event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, actualizar cache
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
        .catch((error) => {
          console.log("🌐 Fetch falló para:", event.request.url)
          // Intentar servir desde cache
          return caches.match(event.request).then((response) => {
            if (response) {
              return response
            }
            // Si no hay cache, mostrar página offline
            return new Response(
              `
              <!DOCTYPE html>
              <html lang="es">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sin Conexión - Admin PWA</title>
                <style>
                  /* Reset y variables CSS */
                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }

                  /* Variables CSS para temas - Mismas que la app */
                  :root {
                    --background: 0 0% 100%;
                    --foreground: 0 0% 9%;
                    --card: 0 0% 100%;
                    --card-foreground: 0 0% 9%;
                    --primary: 0 0% 9%;
                    --primary-foreground: 0 0% 98%;
                    --secondary: 0 0% 96%;
                    --secondary-foreground: 0 0% 9%;
                    --muted: 0 0% 96%;
                    --muted-foreground: 0 0% 45%;
                    --border: 0 0% 90%;
                    --ring: 0 0% 9%;
                    --radius: 0.5rem;
                    --destructive: 0 84% 60%;
                    --destructive-foreground: 0 0% 98%;
                    --warning: 38 92% 50%;
                    --warning-foreground: 48 96% 89%;
                    --success: 142 76% 36%;
                    --success-foreground: 355 100% 97%;
                  }

                  /* Modo oscuro */
                  @media (prefers-color-scheme: dark) {
                    :root {
                      --background: 0 0% 9%;
                      --foreground: 0 0% 98%;
                      --card: 0 0% 9%;
                      --card-foreground: 0 0% 98%;
                      --primary: 0 0% 98%;
                      --primary-foreground: 0 0% 9%;
                      --secondary: 0 0% 14%;
                      --secondary-foreground: 0 0% 98%;
                      --muted: 0 0% 14%;
                      --muted-foreground: 0 0% 64%;
                      --border: 0 0% 14%;
                      --ring: 0 0% 83%;
                      --warning: 48 96% 89%;
                      --warning-foreground: 38 92% 50%;
                      --success: 142 76% 36%;
                      --success-foreground: 355 100% 97%;
                    }
                  }

                  /* Estilos base */
                  body {
                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background-color: hsl(var(--background));
                    color: hsl(var(--foreground));
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    transition: background-color 0.2s, color 0.2s;
                  }

                  /* Contenedor principal */
                  .main-container {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                  }

                  .container {
                    width: 100%;
                    max-width: 28rem;
                    margin: 0 auto;
                  }

                  /* Card - Mismos estilos que la app */
                  .card {
                    background-color: hsl(var(--card));
                    color: hsl(var(--card-foreground));
                    border: 1px solid hsl(var(--border));
                    border-radius: calc(var(--radius) + 2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                    transition: all 0.2s;
                  }

                  .card-header {
                    padding: 1.5rem;
                    text-align: center;
                    border-bottom: 1px solid hsl(var(--border));
                  }

                  .card-content {
                    padding: 1.5rem;
                    text-align: center;
                  }

                  /* Logo */
                  .logo {
                    width: 4rem;
                    height: 4rem;
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border-radius: calc(var(--radius) + 2px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin: 0 auto 1rem auto;
                  }

                  /* Títulos */
                  .title {
                    font-size: 1.875rem;
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                    color: hsl(var(--foreground));
                  }

                  .subtitle {
                    color: hsl(var(--muted-foreground));
                    margin-bottom: 1.5rem;
                    font-size: 0.875rem;
                  }

                  /* Mensaje */
                  .message {
                    color: hsl(var(--muted-foreground));
                    margin-bottom: 2rem;
                    font-size: 1rem;
                  }

                  /* Botón */
                  .button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                    border-radius: var(--radius);
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border: none;
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    min-width: 8rem;
                    text-decoration: none;
                    font-family: inherit;
                  }

                  .button:hover {
                    background-color: hsl(var(--primary) / 0.9);
                  }
                </style>
              </head>
              <body>
                <div class="main-container">
                  <div class="container">
                    <div class="card">
                      <div class="card-header">
                        <div class="logo">A</div>
                        <h1 class="title">Admin PWA</h1>
                        <p class="subtitle">Sistema de Administración</p>
                      </div>
                      
                      <div class="card-content">
                        <p class="message">
                          Sin conexión a internet. Algunas funciones pueden no estar disponibles.
                        </p>
                        <button class="button" onclick="window.location.reload()">
                          Reintentar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `,
              {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "text/html; charset=utf-8" },
              },
            )
          })
        }),
    )
    return
  }

  // Para otros recursos, usar network first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch((error) => {
        return caches.match(event.request).then((response) => {
          if (response) {
            return response
          }
          return new Response("", { status: 404, statusText: "Not Found" })
        })
      }),
  )
})

// Mensaje para comunicación con el cliente
self.addEventListener("message", (event) => {
  console.log("📨 Mensaje recibido en SW:", event.data)

  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("⏭️ Activando nueva versión del SW")
    self.skipWaiting()
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    console.log("🗑️ Limpiando todos los caches")
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              console.log("🗑️ Eliminando cache:", cacheName)
              return caches.delete(cacheName)
            }),
          )
        })
        .then(() => {
          console.log("✅ Todos los caches eliminados")
          // Notificar al cliente que el cache se limpió
          event.ports[0].postMessage({ success: true })
        }),
    )
  }
})

// Push event for notifications
self.addEventListener("push", (event) => {
  console.log("🔔 Push recibido:", event)

  let notificationData = {
    title: "Admin PWA",
    body: "Nueva notificación",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: "admin-notification",
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: "view",
        title: "Ver",
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E",
      },
    ],
  }

  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = { ...notificationData, ...data }
    } catch (e) {
      console.error("❌ Error parseando push data:", e)
      notificationData.body = event.data.text() || "Nueva notificación"
    }
  }

  event.waitUntil(self.registration.showNotification(notificationData.title, notificationData))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notificación clickeada:", event)
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/")
      }
    }),
  )
})
