import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let isStreamActive = true
      let isControllerClosed = false
      const changeStreams: any[] = []
      let heartbeatInterval: NodeJS.Timeout | null = null

      const safeEnqueue = (data: string) => {
        if (!isControllerClosed && isStreamActive) {
          try {
            controller.enqueue(encoder.encode(data))
            return true
          } catch (error) {
            console.log("📡 Controller closed, stopping stream")
            isControllerClosed = true
            isStreamActive = false
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

      const setupChangeStreams = async () => {
        try {
          const client = await clientPromise
          const db = client.db("parking")

          // Collections to monitor
          const collections = ["tickets", "pagos", "cars", "staff"]

          for (const collectionName of collections) {
            try {
              const changeStream = db.collection(collectionName).watch([], {
                fullDocument: "updateLookup",
              })

              changeStream.on("change", async (change) => {
                console.log(`🔍 Change detected in ${collectionName}:`, change.operationType)
                await sendStats()
              })

              changeStream.on("error", (error) => {
                console.error(`Change Stream error for ${collectionName}:`, error)
              })

              changeStreams.push(changeStream)
            } catch (error) {
              console.error(`Failed to setup change stream for ${collectionName}:`, error)
            }
          }

          // Send initial stats
          await sendStats()

          // Send heartbeat every 30 seconds to keep connection alive
          heartbeatInterval = setInterval(() => {
            if (isStreamActive && !isControllerClosed) {
              const heartbeat = `data: ${JSON.stringify({ heartbeat: true, timestamp: new Date().toISOString() })}\n\n`
              const success = safeEnqueue(heartbeat)
              if (!success) {
                // If heartbeat fails, cleanup everything
                cleanup()
              }
            }
          }, 30000)

          // Cleanup function
          const cleanup = () => {
            isStreamActive = false
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval)
              heartbeatInterval = null
            }
            changeStreams.forEach((stream) => {
              try {
                stream.close()
              } catch (error) {
                console.error("Error closing change stream:", error)
              }
            })
            if (!isControllerClosed) {
              try {
                controller.close()
                isControllerClosed = true
              } catch (error) {
                // Controller already closed
              }
            }
          }

          // Handle client disconnect
          return cleanup
        } catch (error) {
          console.error("Error setting up change streams:", error)
          const errorData = `data: ${JSON.stringify({ error: "Failed to setup real-time monitoring" })}\n\n`
          safeEnqueue(errorData)
        }
      }

      const cleanup = await setupChangeStreams()

      // Return cleanup function
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

// Function to calculate statistics
async function calculateStats() {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    // Verify collections exist
    const collections = ["pagos", "tickets", "staff", "cars"]
    const existingCollections = await db.listCollections().toArray()
    const validCollections = collections.every((col) => existingCollections.some((c) => c.name === col))

    if (!validCollections) {
      throw new Error("Some required collections do not exist")
    }

    // Get pending payments
    const pendingPayments = await db.collection("pagos").countDocuments({
      estado: "pendiente_validacion",
    })

    // Get pending confirmations
    const pendingConfirmations = await db.collection("tickets").countDocuments({
      estado: "ocupado",
    })

    // Get total staff
    const totalStaff = await db.collection("staff").countDocuments()

    // Get today's payments in UTC
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const todayPayments = await db.collection("pagos").countDocuments({
      fechaPago: {
        $gte: today,
        $lt: tomorrow,
      },
    })

    // Get ticket statistics
    const totalTickets = await db.collection("tickets").countDocuments()
    const availableTickets = await db.collection("tickets").countDocuments({
      estado: "disponible",
    })

    // Get currently parked cars
    const carsParked = await db.collection("cars").countDocuments({
      estado: { $in: ["estacionado", "estacionado_confirmado", "pago_pendiente"] },
    })

    // Get paid tickets ready for exit
    const paidTickets = await db.collection("tickets").countDocuments({
      estado: "pagado_validado",
    })

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
  } catch (error) {
    console.error("Error calculating stats:", error)
    throw error
  }
}
