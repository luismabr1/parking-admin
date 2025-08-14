import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { exitNote } = await request.json()

    if (!exitNote || typeof exitNote !== "string" || exitNote.trim().length < 10) {
      return NextResponse.json(
        { message: "La nota de salida es obligatoria y debe tener al menos 10 caracteres" },
        { status: 400 },
      )
    }

    const { db } = await connectToDatabase()
    const carId = params.id

    if (!ObjectId.isValid(carId)) {
      return NextResponse.json({ message: "ID de vehículo inválido" }, { status: 400 })
    }

    // Buscar el carro
    const car = await db.collection("cars").findOne({ _id: new ObjectId(carId) })

    if (!car) {
      return NextResponse.json({ message: "Vehículo no encontrado" }, { status: 404 })
    }

    if (car.estado !== "estacionado" && car.estado !== "estacionado_confirmado") {
      return NextResponse.json({ message: "El vehículo no está en estado válido para salida rápida" }, { status: 400 })
    }

    const now = new Date()
    const duracionMinutos = car.horaIngreso
      ? Math.round((now.getTime() - new Date(car.horaIngreso).getTime()) / (1000 * 60))
      : 0

    // Actualizar o crear registro en car_history con upsert
    const historyUpdateResult = await db.collection("car_history").updateOne(
      { carId: new ObjectId(carId) },
      {
        $push: {
          eventos: {
            tipo: "salida_rapida",
            fecha: now,
            estado: "finalizado",
            datos: {
              duracionTotal: duracionMinutos,
              montoTotal: 0,
              horaSalida: now,
              autorizadoPor: "admin",
              exitNote: exitNote.trim(),
            },
          },
        },
        $set: {
          carId: new ObjectId(carId),
          placa: car.placa,
          marca: car.marca,
          modelo: car.modelo,
          color: car.color,
          nombreDueño: car.nombreDueño,
          telefono: car.telefono,
          ticketAsociado: car.ticketAsociado,
          estadoActual: "finalizado",
          activo: false,
          completado: true,
          fechaSalida: now,
          fechaUltimaActualizacion: now,
          duracionTotalMinutos: duracionMinutos,
          tipoSalida: "salida_rapida",
          notaSalida: exitNote.trim(),
          horaSalida: now.toISOString(),
          estado: "finalizado",
          datosFinales: {
            horaSalida: now,
            duracionMinutos: duracionMinutos,
            montoTotalPagado: 0,
            estadoFinal: "salida_rapida",
            notaSalida: exitNote.trim(),
          },
          ultimoEvento: {
            tipo: "salida_rapida",
            fecha: now.toISOString(),
            estado: "finalizado",
          },
        },
      },
      { upsert: true }
    )

    if (historyUpdateResult.modifiedCount === 0 && !historyUpdateResult.upsertedId) {
      throw new Error("Fallo al actualizar o crear el historial del vehículo")
    }

    // Remove car from active collection
    await db.collection("cars").deleteOne({ _id: new ObjectId(carId) })

    // Reset ticket for reuse
    if (car.ticketAsociado) {
      await db.collection("tickets").updateOne(
        { codigoTicket: car.ticketAsociado },
        {
          $set: {
            estado: "disponible",
            horaOcupacion: null,
            horaSalida: null,
            montoCalculado: 0,
            ultimoPagoId: null,
          },
          $unset: {
            carInfo: "",
            duracionMinutos: "",
            fechaConfirmacion: "",
            fechaValidacionPago: "",
            updatedAt: "",
            tipoPago: "",
            tiempoSalida: "",
            tiempoSalidaEstimado: "",
            montoPendiente: "",
            carroAsociado: "",
            fechaOcupacion: "",
          },
        },
      )

      // Deactivate subscriptions
      try {
        await db.collection("ticket_subscriptions").updateMany(
          { ticketCode: car.ticketAsociado, isActive: true },
          {
            $set: {
              isActive: false,
              expiresAt: now,
              "lifecycle.stage": "expired",
              "lifecycle.updatedAt": now,
            },
          },
        )
      } catch (subscriptionError) {
        console.error("Error desactivando suscripciones:", subscriptionError)
      }

      // Send notifications
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        await Promise.all([
          fetch(`${baseUrl}/api/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "quick_exit_processed",
              ticketCode: car.ticketAsociado,
              userType: "user",
              data: {
                plate: car.placa || "N/A",
                duration: duracionMinutos,
                exitNote: exitNote.trim(),
              },
            }),
          }),
          fetch(`${baseUrl}/api/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "quick_exit_processed",
              ticketCode: car.ticketAsociado,
              userType: "admin",
              data: {
                plate: car.placa || "N/A",
                duration: duracionMinutos,
                exitNote: exitNote.trim(),
              },
            }),
          }),
        ])
      } catch (notificationError) {
        console.error("Error enviando notificaciones:", notificationError)
      }
    }

    // Log activity
    await db.collection("activity_log").insertOne({
      tipo: "salida_rapida",
      descripcion: `Salida rápida procesada para vehículo ${car.placa} (${car.marca} ${car.modelo})`,
      detalles: {
        carId: carId,
        placa: car.placa,
        ticketLiberado: car.ticketAsociado,
        notaSalida: exitNote.trim(),
        tiempoEstacionado: duracionMinutos,
      },
      fecha: now,
      timestamp: now.getTime(),
    })

    return NextResponse.json({
      message: `Salida rápida procesada exitosamente. Vehículo ${car.placa} liberado y ticket ${car.ticketAsociado} disponible.`,
      carId: carId,
      ticketLiberado: car.ticketAsociado,
      duracionMinutos: duracionMinutos,
    })
  } catch (error) {
    console.error("Error processing quick exit:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}