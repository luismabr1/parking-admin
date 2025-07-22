import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    let settings = await db.collection("company_settings").findOne({})

    if (!settings) {
      const defaultSettings = {
        pagoMovil: { banco: "", cedula: "", telefono: "" },
        transferencia: { banco: "", cedula: "", telefono: "", numeroCuenta: "" },
        tarifas: {
          precioHoraDiurno: 3.0,
          precioHoraNocturno: 4.0,
          tasaCambio: 36.0,
          horaInicioNocturno: "00:00",
          horaFinNocturno: "06:00",
        },
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
      }

      await db.collection("company_settings").insertOne(defaultSettings)
      settings = defaultSettings
    }

    if (settings.tarifaPorHora && !settings.tarifas) {
      settings.tarifas = {
        precioHoraDiurno: settings.tarifaPorHora || 3.0,
        precioHoraNocturno: (settings.tarifaPorHora || 3.0) * 1.33,
        tasaCambio: settings.tasaCambio || 36.0,
        horaInicioNocturno: "00:00",
        horaFinNocturno: "06:00",
      }

      await db.collection("company_settings").updateOne(
        { _id: settings._id },
        { $set: { tarifas: settings.tarifas }, $unset: { tarifaPorHora: "" } },
      )
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    const data = await req.json()
    console.log("Received data for update:", data)

    const updatedSettings = {
      ...data,
      fechaActualizacion: new Date(),
    }

    // Ejecutar la actualización y asumir éxito si no hay error
    const result = await db
      .collection("company_settings")
      .findOneAndUpdate(
        {}, // Filtro vacío, asume un solo documento
        { $set: updatedSettings },
        { upsert: true, returnDocument: "after" }
      )

    console.log("Update result:", result) // Depuración básica

    // Asumir éxito si no hay excepción
    return NextResponse.json({ message: "Configuración actualizada exitosamente" })
  } catch (error) {
    console.error("Error updating company settings:", error)
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 })
  }
}