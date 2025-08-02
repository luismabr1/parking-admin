import clientPromise from "@/lib/mongodb"

// Simple event emitter for stats updates
class StatsEventEmitter {
  private listeners: Set<() => void> = new Set()

  addListener(callback: () => void) {
    this.listeners.add(callback)
  }

  removeListener(callback: () => void) {
    this.listeners.delete(callback)
  }

  emit() {
    this.listeners.forEach((callback) => {
      try {
        callback()
      } catch (error) {
        console.error("Error in stats listener:", error)
      }
    })
  }
}

const statsEmitter = new StatsEventEmitter()

// Function to fetch current stats from database
async function fetchCurrentStats() {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    // Verificar existencia de colecciones
    const collections = ["pagos", "tickets", "staff", "cars"]
    const existingCollections = await db.listCollections().toArray()
    const validCollections = collections.every((col) => existingCollections.some((c) => c.name === col))
    if (!validCollections) {
      throw new Error("Alguna colección requerida no existe")
    }

    // Obtener estadísticas de pagos pendientes
    const pendingPayments = await db.collection("pagos").countDocuments({
      estado: "pendiente_validacion",
    })

    // Obtener confirmaciones pendientes
    const pendingConfirmations = await db.collection("tickets").countDocuments({
      estado: "ocupado",
    })

    // Obtener total de personal
    const totalStaff = await db.collection("staff").countDocuments()

    // Obtener pagos de hoy en UTC
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

    // Obtener estadísticas de tickets
    const totalTickets = await db.collection("tickets").countDocuments()
    const availableTickets = await db.collection("tickets").countDocuments({
      estado: "disponible",
    })

    // Obtener carros estacionados actualmente
    const carsParked = await db.collection("cars").countDocuments({
      estado: { $in: ["estacionado", "estacionado_confirmado", "pago_pendiente"] },
    })

    // Obtener tickets pagados listos para salir
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
    }
  } catch (error) {
    console.error("Error fetching stats:", error)
    throw error
  }
}

// Function to broadcast stats update (called from other endpoints)
export async function broadcastStatsUpdate() {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Broadcasting stats update...")
    }

    // Emit event to trigger stats refresh in connected clients
    statsEmitter.emit()

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Stats update broadcasted")
    }
  } catch (error) {
    console.error("❌ Error broadcasting stats update:", error)
  }
}

// Export the emitter for use in the hook
export { statsEmitter, fetchCurrentStats }
