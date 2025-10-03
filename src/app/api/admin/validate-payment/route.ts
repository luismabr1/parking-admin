import { type NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
/* import { sendNotificationToTicket } from "@/lib/push-notifications" */

export async function POST(request: NextRequest) {
  try {
    const { pagoId } = await request.json()

    console.log("💰 [VALIDATE-PAYMENT] ===== INICIANDO VALIDACIÓN DE PAGO =====")
    console.log("🕐 [VALIDATE-PAYMENT] Timestamp:", new Date().toISOString())
    console.log("📦 [VALIDATE-PAYMENT] ID de pago recibido:", pagoId)

    if (!pagoId) {
      console.error("❌ [VALIDATE-PAYMENT] ERROR: ID de pago faltante")
      return NextResponse.json({ error: "ID de pago requerido" }, { status: 400 })
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(pagoId)) {
      console.error("❌ [VALIDATE-PAYMENT] ERROR: ID de pago inválido:", pagoId)
      return NextResponse.json({ error: "ID de pago inválido" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("parking")

    // Buscar el pago
    console.log("🔍 [VALIDATE-PAYMENT] Buscando pago en base de datos...")

    const pago = await db.collection("pagos").findOne({ _id: new ObjectId(pagoId) })

    if (!pago) {
      console.error("❌ [VALIDATE-PAYMENT] ERROR: Pago no encontrado:", pagoId)
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
    }

    console.log("✅ [VALIDATE-PAYMENT] Pago encontrado:")
    console.log("   ID:", pago._id)
    console.log("   Código Ticket:", pago.codigoTicket)
    console.log("   Monto:", pago.montoPagado, "Bs")
    console.log("   Monto USD:", pago.montoPagadoUsd, "USD")
    console.log("   Estado actual:", pago.estado)
    console.log("   Estado validación:", pago.estadoValidacion)
    console.log("   Tipo de pago:", pago.tipoPago)
    console.log("   Fecha pago:", pago.fechaPago)

    // Check if already validated
    if (pago.estadoValidacion === "validado") {
      console.log("⚠️ [VALIDATE-PAYMENT] Pago ya está validado")
      return NextResponse.json({
        success: true,
        message: "Pago ya estaba validado",
        alreadyValidated: true,
      })
    }

    const now = new Date()

    // Actualizar el pago
    console.log("🔄 [VALIDATE-PAYMENT] Actualizando estado del pago...")

    const pagoUpdateResult = await db.collection("pagos").updateOne(
      { _id: new ObjectId(pagoId) },
      {
        $set: {
          estado: "validado",
          estadoValidacion: "validado",
          fechaValidacion: now,
          validadoPor: "admin",
        },
      },
    )

    console.log("✅ [VALIDATE-PAYMENT] Pago actualizado:")
    console.log("   Documentos modificados:", pagoUpdateResult.modifiedCount)
    console.log("   Matched count:", pagoUpdateResult.matchedCount)

    // Actualizar el ticket
    console.log("🎫 [VALIDATE-PAYMENT] Actualizando estado del ticket:", pago.codigoTicket)

    const ticketUpdateResult = await db.collection("tickets").updateOne(
      { codigoTicket: pago.codigoTicket },
      {
        $set: {
          estado: "pagado_validado",
          fechaValidacionPago: now,
        },
      },
    )

    console.log("✅ [VALIDATE-PAYMENT] Ticket actualizado:")
    console.log("   Documentos modificados:", ticketUpdateResult.modifiedCount)
    console.log("   Matched count:", ticketUpdateResult.matchedCount)

    // Get car info for notification
    console.log("🚗 [VALIDATE-PAYMENT] Buscando información del vehículo...")

    const car = await db.collection("cars").findOne({ ticketAsociado: pago.codigoTicket })

    if (car) {
      console.log("✅ [VALIDATE-PAYMENT] Vehículo encontrado:")
      console.log("   Placa:", car.placa)
      console.log("   Propietario:", car.nombreDueño || "N/A")
      console.log("   Estado:", car.estado)
    } else {
      console.log("⚠️ [VALIDATE-PAYMENT] No se encontró vehículo asociado")
    }

    // Registrar en car_history
    console.log("📚 [VALIDATE-PAYMENT] Actualizando historial del vehículo...")

    const carHistoryUpdate = {
      $push: {
        eventos: {
          tipo: "pago_validado",
          fecha: now,
          estado: "pago_confirmado",
          datos: {
            pagoId: pagoId,
            tipoPago: pago.tipoPago,
            montoPagado: pago.montoPagado,
            montoPagadoUsd: pago.montoPagadoUsd,
            tasaCambio: pago.tasaCambioUsada,
            referenciaTransferencia: pago.referenciaTransferencia,
            banco: pago.banco,
            telefono: pago.telefono,
            numeroIdentidad: pago.numeroIdentidad,
            urlImagenComprobante: pago.urlImagenComprobante,
            validadoPor: "admin",
          },
        },
        pagos: {
          pagoId: pagoId,
          tipoPago: pago.tipoPago,
          montoPagado: pago.montoPagado,
          montoPagadoUsd: pago.montoPagadoUsd,
          tasaCambio: pago.tasaCambioUsada,
          fechaPago: pago.fechaPago,
          fechaValidacion: now,
          estado: "validado",
          referenciaTransferencia: pago.referenciaTransferencia,
          banco: pago.banco,
        },
      },
      $set: {
        estadoActual: "pago_confirmado",
        fechaUltimaActualizacion: now,
        fechaConfirmacionPago: now,
      },
    }

    const historyUpdateResult = await db
      .collection("car_history")
      .updateOne({ ticketAsociado: pago.codigoTicket }, carHistoryUpdate)

    console.log("✅ [VALIDATE-PAYMENT] Historial actualizado:")
    console.log("   Documentos modificados:", historyUpdateResult.modifiedCount)
    console.log("   Matched count:", historyUpdateResult.matchedCount)

    // Send notification to USER (not admin) about payment validation
    try {
      console.log("🔔 [VALIDATE-PAYMENT] Enviando notificación al USUARIO...")
      console.log("   Ticket Code:", pago.codigoTicket)
      console.log("   User Type: user")
      console.log("   Monto:", pago.montoPagado, "Bs")
      console.log("   Placa:", car?.placa || "N/A")

/*       const notificationResult = await sendNotificationToTicket(pago.codigoTicket, {
        title: "✅ Pago Validado",
        body: `Tu pago de ${pago.montoPagado} Bs ha sido validado. Vehículo: ${car?.placa || "N/A"}`,
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
        data: {
          type: "payment_validated",
          ticketCode: pago.codigoTicket,
          amount: pago.montoPagado,
          plate: car?.placa || "N/A",
        },
      })

      console.log("✅ [VALIDATE-PAYMENT] Notificación enviada:", {
        sent: notificationResult.sent,
        total: notificationResult.total,
        errors: notificationResult.errors.length,
      })*/
    } catch (notificationError) {
      console.error("❌ [VALIDATE-PAYMENT] Error sending notification:", notificationError)
      // Log but don't fail the payment validation
    } 

    // Trigger stats update event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("statsUpdate"))
    }

    console.log("✅ [VALIDATE-PAYMENT] ===== VALIDACIÓN COMPLETADA EXITOSAMENTE =====")
    console.log("   Pago ID:", pagoId)
    console.log("   Ticket:", pago.codigoTicket)
    console.log("   Monto validado:", pago.montoPagado, "Bs")

    return NextResponse.json({
      success: true,
      message: "Pago validado correctamente",
      pagoId: pagoId,
      ticketCode: pago.codigoTicket,
      amount: pago.montoPagado,
    })
  } catch (error) {
    console.error("❌ [VALIDATE-PAYMENT] ===== ERROR CRÍTICO =====")
    console.error("   Error:", error.message)
    console.error("   Stack trace:", error.stack)
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 })
  }
}
