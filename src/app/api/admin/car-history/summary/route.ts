import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    // Realizar agregación para obtener el resumen financiero
    const summary = await db.collection("car_history").aggregate([
      {
        $group: {
          _id: null,
          totalPagado: { $sum: { $sum: "$pagos.montoPagado" } }, // Suma de todos los montosPagado en pagos
          totalRechazado: { $sum: { $sum: "$pagosRechazados.monto" } }, // Suma de todos los montos en pagosRechazados
          totalPendiente: { $sum: { $sum: "$montosPendientes.monto" } }, // Suma de todos los montos en montosPendientes
          totalRegistros: { $sum: 1 }, // Conteo total de registros
        },
      },
    ]).toArray()

    // Extraer el resumen (asumimos que solo habrá un documento con _id: null)
    const financialSummary = summary[0] || {
      totalPagado: 0,
      totalRechazado: 0,
      totalPendiente: 0,
      totalRegistros: 0,
    }

    const response = NextResponse.json({
      summary: financialSummary,
    })

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error fetching financial summary:", error)
    }
    return NextResponse.json({ message: "Error al obtener el resumen financiero" }, { status: 500 })
  }
}