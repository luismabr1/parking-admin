import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    console.log("💰 [SUBMIT-PAYMENT] ===== INICIANDO PROCESAMIENTO DE PAGO =====")

    const client = await clientPromise
    const db = client.db("parking")

    let requestBody
    try {
      requestBody = await request.json()
      console.log("📥 [SUBMIT-PAYMENT] Datos recibidos:", JSON.stringify(requestBody, null, 2))
    } catch (error) {
      console.error("❌ [SUBMIT-PAYMENT] Error parsing JSON:", error)
      return NextResponse.json({ message: "Datos JSON inválidos" }, { status: 400 })
    }

    const {
      codigoTicket,
      montoPagado,
      montoPagadoUsd,
      tipoPago,
      referenciaTransferencia,
      banco,
      imagenComprobante,
    } = requestBody

    console.log("🔍 [SUBMIT-PAYMENT] Validando parámetros...")
    console.log("- codigoTicket:", codigoTicket)
    console.log("- montoPagado:", montoPagado)
    console.log("- tipoPago:", tipoPago)

    if (!codigoTicket || !montoPagado || !tipoPago) {
      const errorMsg = "Faltan datos requeridos: codigoTicket, montoPagado, tipoPago"
      console.error("❌ [SUBMIT-PAYMENT] Validación fallida:", errorMsg)
      return NextResponse.json({ message: errorMsg }, { status: 400 })
    }

    // Buscar el ticket
    console.log("🎫 [SUBMIT-PAYMENT] Buscando ticket:", codigoTicket)
    const ticket = await db.collection("tickets").findOne({ codigoTicket })

    if (!ticket) {
      console.error("❌ [SUBMIT-PAYMENT] Ticket no encontrado:", codigoTicket)
      return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 })
    }

    // Buscar el carro asociado
    console.log("🚗 [SUBMIT-PAYMENT] Buscando carro asociado...")
    const car = await db.collection("cars").findOne({ ticketAsociado: codigoTicket })

    if (!car) {
      console.error("❌ [SUBMIT-PAYMENT] Carro no encontrado para ticket:", codigoTicket)
      return NextResponse.json({ message: "Vehículo no encontrado" }, { status: 404 })
    }

    console.log("✅ [SUBMIT-PAYMENT] Carro encontrado:", {
      placa: car.placa,
      estado: car.estado,
    })

    const now = new Date()

    // Crear el pago
    const pagoData = {
      codigoTicket,
      montoPagado: Number(montoPagado),
      montoPagadoUsd: Number(montoPagadoUsd) || 0,
      montoCalculado: ticket.montoCalculado || 0,
      tipoPago,
      referenciaTransferencia: referenciaTransferencia || "",
      banco: banco || "",
      imagenComprobante: imagenComprobante || "",
      fechaPago: now,
      estado: "pendiente_validacion",
      estadoValidacion: "pendiente",
      placa: car.placa,
      marca: car.marca,
      modelo: car.modelo,
      color: car.color,
    }

    console.log("💾 [SUBMIT-PAYMENT] Guardando pago...")
    const pagoResult = await db.collection("pagos").insertOne(pagoData)
    console.log("✅ [SUBMIT-PAYMENT] Pago guardado con ID:", pagoResult.insertedId)

    // Actualizar estado del ticket y carro
    await db.collection("tickets").updateOne(
      { codigoTicket },
      { $set: { estado: "pago_pendiente_validacion" } }
    )

    await db.collection("cars").updateOne(
      { _id: car._id },
      { $set: { estado: "pago_pendiente_validacion" } }
    )

    console.log("✅ [SUBMIT-PAYMENT] Estados actualizados")

    // Enviar notificación al ADMIN sobre el nuevo pago
    try {
      console.log("🔔 [SUBMIT-PAYMENT] Enviando notificación al ADMIN...")

      const notificationPayload = {
        type: "payment_received",
        ticketCode: codigoTicket,
        userType: "admin", // Send to ADMIN
        data: {
          amount: Number(montoPagado),
          plate: car.placa,
          paymentType: tipoPago,
          reference: referenciaTransferencia || "",
          bank: banco || "",
        },
      }

      console.log("📦 [SUBMIT-PAYMENT] Payload de notificación:", notificationPayload)

      const notificationResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/send-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(notificationPayload),
        },
      )

      if (notificationResponse.ok) {
        const responseData = await notificationResponse.json()
        console.log("✅ [SUBMIT-PAYMENT] Notificación enviada al admin exitosamente:")
        console.log("   Enviadas:", responseData.sent)
        console.log("   Total:", responseData.total)
      } else {
        const errorText = await notificationResponse.text()
        console.error("❌ [SUBMIT-PAYMENT] Error en notificación:", errorText)
      }
    } catch (notificationError) {
      console.error("❌ [SUBMIT-PAYMENT] Error sending notification:", notificationError)
      // Don't fail the payment submission for notification errors
    }

    const processingTime = Date.now() - startTime
    console.log(`✅ [SUBMIT-PAYMENT] Pago procesado exitosamente en ${processingTime}ms`)

    const response = NextResponse.json({
      message: "Pago enviado exitosamente. Será validado por el administrador.",
      pagoId: pagoResult.insertedId,
      estado: "pendiente_validacion",
    })

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")

    return response
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`❌ [SUBMIT-PAYMENT] Error después de ${processingTime}ms:`, error)

    return NextResponse.json(
      {
        message: "Error al procesar el pago",
        ...(process.env.NODE_ENV === "development" && {
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      { status: 500 },
    )
  }
}
