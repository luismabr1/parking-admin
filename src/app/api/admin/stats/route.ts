import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"

export async function GET() {
  const encoder = new TextEncoder()
  const client = await clientPromise
  const db = client.db("parking")

  const stream = new ReadableStream({
    async start(controller) {
      let isStreamActive = true
      let isControllerClosed = false
      let changeStream: any = null
      let heartbeatInterval: NodeJS.Timeout | null = null
      let lastActivityTime = Date.now()
      const INACTIVITY_THRESHOLD = 5 * 60 * 1000 // 5 minutes in milliseconds
      const THROTTLED_INTERVAL = 2 * 60 * 1000 // 2 minutes in milliseconds
      let isThrottled = false

      const safeEnqueue = (data: string) => {
        if (!isControllerClosed && isStreamActive) {
          try {
            controller.enqueue(encoder.encode(data))
            lastActivityTime = Date.now() // Update activity on successful send
            return true
          } catch (error) {
            console.log("📡 Controller closed, stopping stream")
            isControllerClosed = true
            isStreamActive = false
            cleanup()
            return false
          }
        }
        return false
      }

      const sendStats = async () => {
        if (!isStreamActive || isControllerClosed) return

        try {
          const stats = await calculateStats()
          const data = `data: ${JSON.stringify(stats)}\n\n`
          safeEnqueue(data)
        } catch (error) {
          console.error("Error calculating stats:", error)
          const errorData = `data: ${JSON.stringify({ error: "Error calculating stats" })}\n\n`
          safeEnqueue(errorData)
        }
      }

      const setupChangeStream = async () => {
        try {
          // Use a single Change Stream with a pipeline to monitor multiple collections
          changeStream = db
            .collection("tickets")
            .watch(
              [
                { $match: { "ns.coll": { $in: ["tickets", "pagos", "cars", "staff"] } } },
              ],
              { fullDocument: "updateLookup" },
            )

          changeStream.on("change", async (change) => {
            console.log(`🔍 Change detected: ${change.operationType} in ${change.ns.coll}`)
            lastActivityTime = Date.now() // Update activity on change
            if (isThrottled) {
              // If throttled, wait for the next scheduled update
              return
            }
            await sendStats()
          })

          changeStream.on("error", (error) => {
            console.error("Change Stream error:", error)
          })

          // Send initial stats
          await sendStats()

          // Start heartbeat with activity-aware logic
          heartbeatInterval = setInterval(() => {
            const inactivityDuration = Date.now() - lastActivityTime
            if (inactivityDuration > INACTIVITY_THRESHOLD && !isThrottled) {
              console.log("📡 Switching to throttled mode due to inactivity")
              isThrottled = true
              clearInterval(heartbeatInterval)
              heartbeatInterval = setInterval(throttledUpdate, THROTTLED_INTERVAL)
              cleanupChangeStream() // Close Change Stream during inactivity
            } else if (isStreamActive && !isControllerClosed) {
              const heartbeat = `data: ${JSON.stringify({ heartbeat: true, timestamp: new Date().toISOString() })}\n\n`
              const success = safeEnqueue(heartbeat)
              if (!success) {
                cleanup()
              }
            }
          }, 30000) // 30-second heartbeat while active
        } catch (error) {
          console.error("Error setting up change stream:", error)
          const errorData = `data: ${JSON.stringify({ error: "Failed to setup real-time monitoring" })}\n\n`
          safeEnqueue(errorData)
        }
      }

      const throttledUpdate = async () => {
        if (!isStreamActive || isControllerClosed) return
        await sendStats()
        const inactivityDuration = Date.now() - lastActivityTime
        if (inactivityDuration <= INACTIVITY_THRESHOLD) {
          console.log("📡 Resuming normal mode due to activity")
          isThrottled = false
          clearInterval(heartbeatInterval)
          heartbeatInterval = setInterval(() => {
            if (isStreamActive && !isControllerClosed) {
              const heartbeat = `data: ${JSON.stringify({ heartbeat: true, timestamp: new Date().toISOString() })}\n\n`
              const success = safeEnqueue(heartbeat)
              if (!success) cleanup()
            }
          }, 30000)
          await setupChangeStream() // Reopen Change Stream
        }
      }

      const cleanupChangeStream = () => {
        if (changeStream) {
          try {
            changeStream.close()
            changeStream = null
          } catch (error) {
            console.error("Error closing change stream:", error)
          }
        }
      }

      const cleanup = () => {
        isStreamActive = false
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          heartbeatInterval = null
        }
        cleanupChangeStream()
        if (!isControllerClosed) {
          try {
            controller.close()
            isControllerClosed = true
          } catch (error) {
            // Controller already closed
          }
        }
      }

      await setupChangeStream()

      return cleanup
    },

    cancel() {
      console.log("📡 SSE stream cancelled by client")
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  })
}

async function calculateStats() {
  const client = await clientPromise
  const db = client.db("parking")

  const collections = ["pagos", "tickets", "staff", "cars"]
  const existingCollections = await db.listCollections().toArray()
  if (!collections.every((col) => existingCollections.some((c) => c.name === col))) {
    throw new Error("Some required collections do not exist")
  }

  const [
    pendingPayments,
    pendingConfirmations,
    totalStaff,
    todayPayments,
    totalTickets,
    availableTickets,
    carsParked,
    paidTickets,
  ] = await Promise.all([
    db.collection("pagos").countDocuments({ estado: "pendiente_validacion" }),
    db.collection("tickets").countDocuments({ estado: "ocupado" }),
    db.collection("staff").countDocuments(),
    db.collection("pagos").countDocuments({
      fechaPago: {
        $gte: new Date(new Date().setUTCHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setUTCHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000),
      },
    }),
    db.collection("tickets").countDocuments(),
    db.collection("tickets").countDocuments({ estado: "disponible" }),
    db.collection("cars").countDocuments({ estado: { $in: ["estacionado", "estacionado_confirmado", "pago_pendiente"] } }),
    db.collection("tickets").countDocuments({ estado: "pagado_validado" }),
  ])

  return {
    pendingPayments,
    pendingConfirmations,
    totalStaff,
    todayPayments,
    totalTickets,
    availableTickets,
    carsParked,
    paidTickets,
    timestamp: new Date().toISOString(),
  }
}