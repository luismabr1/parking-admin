import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { placa, marca, modelo, color, nombreDueño, telefono, plateImageUrl, vehicleImageUrl, nota, estado } = body

    console.log("🔄 Actualizando carro:", params.id, body)

    const client = await clientPromise
    const db = client.db("parking")

    // Obtener el estado actual del vehículo
    const currentCar = await db.collection("cars").findOne({ _id: new ObjectId(params.id) })
    if (!currentCar) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
    }

    // Preparar datos de actualización
    const updateData: any = {
      lastModified: new Date(),
    }

    // Actualizar campos básicos si se proporcionan
    if (placa !== undefined) updateData.placa = placa.toUpperCase()
    if (marca !== undefined) updateData.marca = marca
    if (modelo !== undefined) updateData.modelo = modelo
    if (color !== undefined) updateData.color = color
    if (nombreDueño !== undefined) updateData.nombreDueño = nombreDueño
    if (telefono !== undefined) updateData.telefono = telefono
    if (nota !== undefined) updateData.nota = nota
    if (estado !== undefined && ["estacionado", "estacionado_validado", "salida_iniciada", "completado"].includes(estado)) {
      updateData.estado = estado
    }

    // Actualizar imágenes si se proporcionan
    if (plateImageUrl || vehicleImageUrl) {
      const imagenesActualizadas = {
        ...currentCar.imagenes,
        fechaCaptura: new Date(),
      }

      if (plateImageUrl) {
        imagenesActualizadas.plateImageUrl = plateImageUrl
        imagenesActualizadas.capturaMetodo = "camara_movil"
      }

      if (vehicleImageUrl) {
        imagenesActualizadas.vehicleImageUrl = vehicleImageUrl
        imagenesActualizadas.capturaMetodo = "camara_movil"
      }

      updateData.imagenes = imagenesActualizadas
    }

    console.log("📝 Datos a actualizar:", updateData)

    const result = await db.collection("cars").updateOne({ _id: new ObjectId(params.id) }, { $set: updateData })

    console.log("✅ Resultado actualización:", result)

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
    }

    if (result.modifiedCount > 0) {
      // Notificar cambio de estado si se actualizó
      if (estado && estado !== currentCar.estado) {
        const notificationType = {
          estacionado_validado: "vehicle_validated",
          salida_iniciada: "vehicle_exit_started",
          completado: "vehicle_completed",
        }[estado] || "vehicle_updated"

        console.log(`🔔 [CARS] Enviando notificación por cambio de estado a ${notificationType}`)
        const notificationResponse = await fetch("http://localhost:3000/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: notificationType,
            userType: "admin",
            ticketCode: currentCar.ticketAsociado,
            data: {
              plate: currentCar.placa,
              newState: estado,
              timestamp: new Date().toISOString(),
            },
          }),
        })

        if (notificationResponse.ok) {
          const notificationResult = await notificationResponse.json()
          console.log(
            `✅ [CARS] Notificación enviada exitosamente: ${notificationResult.sent}/${notificationResult.total}`,
          )
        } else {
          console.error(
            `⚠️ [CARS] Error al enviar notificación: ${notificationResponse.status} - ${await notificationResponse.text()}`,
          )
        }
      }
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ message: "No se realizaron cambios" }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      message: "Vehículo actualizado correctamente",
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    console.error("❌ Error updating car:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}