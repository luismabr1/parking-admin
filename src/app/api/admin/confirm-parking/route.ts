import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db("parking")
    const body = await request.json()

    console.log("🔍 [CONFIRM-PARKING] POST request received", body)

    if (!body || Object.keys(body).length === 0) {
      console.log("❌ [CONFIRM-PARKING] Cuerpo de solicitud vacío")
      return NextResponse.json(
        { message: "El cuerpo de la solicitud está vacío. Se requiere 'ticketCode'." },
        { status: 400 },
      )
    }

    const { ticketCode } = body

    if (!ticketCode) {
      return NextResponse.json({ message: "Código de ticket requerido" }, { status: 400 })
    }

    const now = new Date()

    const ticket = await db.collection("tickets").findOne({
      codigoTicket: ticketCode,
      estado: "ocupado",
    })

    if (!ticket) {
      return NextResponse.json({ message: "Ticket no encontrado o no está ocupado" }, { status: 404 })
    }

    const car = await db.collection("cars").findOne({
      ticketAsociado: ticketCode,
      estado: "estacionado",
    })

    if (!car) {
      return NextResponse.json({ message: "No se encontró el vehículo asociado a este ticket" }, { status: 404 })
    }

    const carId = car._id.toString()

    const carResult = await db.collection("cars").updateOne(
      { _id: new ObjectId(carId) },
      {
        $set: {
          estado: "estacionado_confirmado",
          fechaEstacionamiento: now,
          updatedAt: now,
        },
      },
    )

    if (carResult.matchedCount === 0) {
      return NextResponse.json({ message: "Error actualizando el vehículo" }, { status: 404 })
    }

    await db.collection("tickets").updateOne(
      { codigoTicket: ticketCode },
      {
        $set: {
          estado: "validado",
          fechaConfirmacion: now,
          updatedAt: now,
          carInfo: {
            _id: car._id,
            placa: car.placa,
            marca: car.marca,
            modelo: car.modelo,
            color: car.color,
            nombreDueño: car.nombreDueño,
            telefono: car.telefono,
            horaIngreso: car.horaIngreso,
            fechaRegistro: car.fechaRegistro,
            imagenes: car.imagenes || {},
          },
        },
      },
    )

    await db.collection("car_history").updateOne(
      { carId: carId },
      {
        $set: {
          estadoActual: "estacionado_confirmado",
          fechaUltimaActualizacion: now,
        },
        $push: {
          eventos: {
            tipo: "confirmacion_estacionamiento",
            fecha: now,
            estado: "estacionado_confirmado",
            datos: {
              ticketCodigo: ticketCode,
              confirmadoPor: "admin",
            },
          },
        },
      },
      { upsert: true },
    )

    try {
      console.log("🔔 [CONFIRM-PARKING] Sending vehicle parked notification to admin...")
      const notificationResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/send-notification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "vehicle_parked",
            ticketCode: ticketCode,
            userType: "admin",
            data: {
              plate: car.placa || "N/A",
              marca: car.marca || "",
              modelo: car.modelo || "",
              color: car.color || "",
              timestamp: now.toISOString(),
            },
          }),
        },
      )

      if (notificationResponse.ok) {
        const notificationResult = await notificationResponse.json()
        console.log("✅ [CONFIRM-PARKING] Vehicle parked notification sent to admin:", notificationResult)
      } else {
        const errorText = await notificationResponse.text()
        console.error("❌ [CONFIRM-PARKING] Failed to send vehicle parked notification:", errorText)
      }
    } catch (notificationError) {
      console.error("❌ [CONFIRM-PARKING] Error sending parking confirmation notification:", notificationError)
    }

    // Trigger stats update event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("statsUpdate"))
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Estacionamiento confirmado para ticket:", ticketCode, "carId:", carId)
    }

    return NextResponse.json({
      success: true,
      message: "Parking confirmed successfully",
      ticketCode,
      carId: car._id,
      plate: car.placa,
    })
  } catch (error) {
    console.error("❌ [CONFIRM-PARKING] Error in confirm-parking:", error)
    console.error("   Stack:", error.stack)
    return NextResponse.json(
      { message: "Error en el proceso", error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 },
    )
  }
}
