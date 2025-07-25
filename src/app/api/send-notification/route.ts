import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { pushNotificationService } from "@/lib/push-notifications"

export async function POST(request: Request) {
  try {
    console.log("🔔 [SEND-NOTIFICATION] ===== INICIANDO ENVÍO DE NOTIFICACIÓN =====")
    console.log("🕐 [SEND-NOTIFICATION] Timestamp:", new Date().toISOString())

    const client = await clientPromise
    const db = client.db("parking")

    const body = await request.json()
    console.log("📦 [SEND-NOTIFICATION] Payload recibido:", JSON.stringify(body, null, 2))

    const { type, ticketCode, userType, data } = body

    if (!type) {
      console.error("❌ [SEND-NOTIFICATION] Tipo de notificación faltante")
      return NextResponse.json({ error: "Tipo de notificación requerido" }, { status: 400 })
    }

    console.log("🔍 [SEND-NOTIFICATION] Parámetros:")
    console.log("   Tipo:", type)
    console.log("   Ticket Code:", ticketCode)
    console.log("   User Type:", userType)
    console.log("   Data:", data)

    let subscriptions = []
    let query: any = {}

    if (type === "test") {
      query = {
        ticketCode: "TEST-001",
        isActive: true,
      }
      console.log("🧪 [SEND-NOTIFICATION] Modo TEST - Buscando suscripciones para TEST-001")
    } else if (userType === "admin") {
      query = {
        userType: "admin",
        isActive: true,
        $or: [
          { isVirtual: { $exists: false } },
          { isVirtual: false },
        ],
      }
      console.log("👨‍💼 [SEND-NOTIFICATION] Buscando suscripciones REALES de ADMIN")
    } else if (userType === "user" && ticketCode) {
      query = {
        ticketCode: ticketCode,
        userType: "user",
        isActive: true,
        $or: [
          { isPlaceholder: { $exists: false } },
          { isPlaceholder: false },
        ],
      }
      console.log("👤 [SEND-NOTIFICATION] Buscando suscripciones REALES de USER para ticket:", ticketCode)
    } else {
      console.error("❌ [SEND-NOTIFICATION] Parámetros insuficientes para determinar suscripciones")
      return NextResponse.json({ error: "Parámetros insuficientes" }, { status: 400 })
    }

    console.log("🔍 [SEND-NOTIFICATION] Query de búsqueda:", JSON.stringify(query, null, 2))

    const subscriptionDocs = await db.collection("ticket_subscriptions").find(query).toArray()

    console.log("📊 [SEND-NOTIFICATION] Resultados de búsqueda:")
    console.log("   Total encontradas:", subscriptionDocs.length)

    subscriptionDocs.forEach((doc, index) => {
      console.log(`🔍 [SEND-NOTIFICATION] Suscripción ${index + 1}:`)
      console.log(`   _id: ${doc._id}`)
      console.log(`   Ticket: ${doc.ticketCode || "undefined"}`)
      console.log(`   UserType: ${doc.userType}`)
      console.log(`   Active: ${doc.isActive}`)
      console.log(`   Virtual: ${doc.isVirtual}`)
      console.log(`   Placeholder: ${doc.isPlaceholder}`)
      console.log(`   Endpoint: ${doc.subscription?.endpoint?.substring(0, 50)}...`)
      console.log(`   P256DH: ${doc.subscription?.keys?.p256dh?.substring(0, 20)}...`)
      console.log(`   Auth: ${doc.subscription?.keys?.auth?.substring(0, 20)}...`)
    })

    if (subscriptionDocs.length === 0) {
      console.log("⚠️ [SEND-NOTIFICATION] No se encontraron suscripciones activas")
      return NextResponse.json({
        success: true,
        message: "No hay suscripciones activas",
        sent: 0,
        total: 0,
        query: query,
      })
    }

    subscriptions = subscriptionDocs
      .map((doc) => doc.subscription)
      .filter((sub) => {
        if (!sub || !sub.endpoint || !sub.keys) {
          console.log("❌ [SEND-NOTIFICATION] Suscripción sin endpoint o keys")
          return false
        }
        const hasRealKeys =
          sub.keys.p256dh &&
          sub.keys.auth &&
          sub.keys.p256dh !== "admin-virtual-key" &&
          sub.keys.p256dh !== "user-placeholder-key" &&
          sub.keys.auth !== "admin-virtual-auth" &&
          sub.keys.auth !== "user-placeholder-auth"
        if (!hasRealKeys) {
          console.log("❌ [SEND-NOTIFICATION] Suscripción con keys hardcodeadas, omitiendo")
          return false
        }
        console.log("✅ [SEND-NOTIFICATION] Suscripción válida con keys reales")
        return true
      })

    console.log("✅ [SEND-NOTIFICATION] Suscripciones válidas encontradas:", subscriptions.length)

    if (subscriptions.length === 0) {
      console.log("❌ [SEND-NOTIFICATION] No hay suscripciones válidas para enviar")
      return NextResponse.json({
        success: true,
        message: "No hay suscripciones válidas con keys reales",
        sent: 0,
        total: subscriptionDocs.length,
      })
    }

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.error("❌ [SEND-NOTIFICATION] Claves VAPID no configuradas correctamente")
      console.error("   NEXT_PUBLIC_VAPID_PUBLIC_KEY:", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? "Definida" : "Indefinida")
      console.error("   VAPID_PRIVATE_KEY:", process.env.VAPID_PRIVATE_KEY ? "Definida" : "Indefinida")
      return NextResponse.json(
        { error: "Claves VAPID no configuradas. Verifica el archivo .env" },
        { status: 500 },
      )
    }

    let notificationPayload

    console.log("🎨 [SEND-NOTIFICATION] Creando payload de notificación para tipo:", type)

    switch (type) {
      case "test":
        notificationPayload = {
          title: "🧪 Notificación de Prueba",
          body: `Esta es una notificación de prueba enviada a las ${new Date().toLocaleTimeString("es-ES")}`,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
          tag: `test-${Date.now()}`,
          data: { type: "test", timestamp: new Date().toISOString(), ...data },
        }
        break
      case "vehicle_registered":
        notificationPayload = {
          title: "📝 Vehículo Registrado",
          body: `Vehículo ${data.plate || "N/A"} registrado en el sistema. Ticket: ${ticketCode}`,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
          tag: `vehicle-registered-${ticketCode}`,
          data: { type: "vehicle_registered", ticketCode, plate: data.plate, timestamp: data.timestamp },
        }
        break
      case "payment_validated":
        notificationPayload = pushNotificationService.createPaymentValidatedNotification(ticketCode, data.amount || 0)
        break
      case "payment_rejected":
        notificationPayload = pushNotificationService.createPaymentRejectedNotification(
          ticketCode,
          data.reason || "Motivo no especificado",
        )
        break
      case "vehicle_parked":
        notificationPayload = pushNotificationService.createVehicleParkedNotification(ticketCode, data.plate || "N/A")
        break
      case "vehicle_exit":
        notificationPayload = pushNotificationService.createVehicleExitNotification(ticketCode, data.plate || "N/A")
        break
      case "vehicle_delivered":
        notificationPayload = pushNotificationService.createVehicleDeliveredNotification(
          ticketCode,
          data.plate || "N/A",
          data.duration || 0,
          data.amount || 0,
        )
        break
      case "admin_payment":
        notificationPayload = pushNotificationService.createAdminPaymentNotification(
          ticketCode,
          data.amount || 0,
          data.plate || "N/A",
        )
        break
      case "admin_exit_request":
        notificationPayload = pushNotificationService.createAdminExitRequestNotification(
          ticketCode,
          data.plate || "N/A",
        )
        break
      default:
        console.error("❌ [SEND-NOTIFICATION] Tipo de notificación no reconocido:", type)
        return NextResponse.json({ error: "Tipo de notificación no válido" }, { status: 400 })
    }

    console.log("📝 [SEND-NOTIFICATION] Payload creado:")
    console.log("   Título:", notificationPayload.title)
    console.log("   Cuerpo:", notificationPayload.body)
    console.log("   Tag:", notificationPayload.tag)
    console.log("   VAPID Headers (antes de envío):", {
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) + "...",
      privateKey: process.env.VAPID_PRIVATE_KEY?.substring(0, 20) + "...",
    })

    console.log("📤 [SEND-NOTIFICATION] Enviando notificaciones...")
    const sentCount = await pushNotificationService.sendToMultipleSubscriptions(subscriptions, notificationPayload)

    console.log("📤 [SEND-NOTIFICATION] Respuesta de envío:", {
      sent: sentCount,
      total: subscriptions.length,
      successRate: subscriptions.length > 0 ? ((sentCount / subscriptions.length) * 100).toFixed(1) + "%" : "0%",
    })

    if (sentCount > 0) {
      const subscriptionIds = subscriptionDocs.map((doc) => doc._id)
      await db.collection("ticket_subscriptions").updateMany(
        { _id: { $in: subscriptionIds } },
        { $set: { lastUsed: new Date(), "lifecycle.updatedAt": new Date() } },
      )
      console.log("✅ [SEND-NOTIFICATION] Timestamps de suscripciones actualizados")
    } else {
      console.log("⚠️ [SEND-NOTIFICATION] No se enviaron notificaciones, no se actualizan timestamps")
    }

    console.log("✅ [SEND-NOTIFICATION] ===== ENVÍO COMPLETADO =====")

    return NextResponse.json({
      success: true,
      message: `Notificaciones enviadas: ${sentCount}/${subscriptions.length}`,
      sent: sentCount,
      total: subscriptions.length,
      type: type,
      ticketCode: ticketCode,
      userType: userType,
    })
  } catch (error) {
    console.error("❌ [SEND-NOTIFICATION] ===== ERROR CRÍTICO =====")
    console.error("   Error:", error.message)
    console.error("   Stack:", error.stack)
    if (error.name === "WebPushError" && error.statusCode) {
      console.error("   Status Code:", error.statusCode)
      console.error("   Body:", error.body)
      console.error("   Headers:", error.headers)
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
        statusCode: error.statusCode,
      },
      { status: 500 },
    )
  }
}