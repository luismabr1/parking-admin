import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    const cars = await db
      .collection("cars")
      .find({ estado: { $in: ["estacionado", "estacionado_confirmado"] } })
      .sort({ horaIngreso: -1 })
      .toArray()

    return NextResponse.json(cars)
  } catch (error) {
    console.error("Error fetching cars:", error)
    return NextResponse.json({ error: "Error al obtener carros" }, { status: 500 })
  }
}

export async function POST(request) {
  return handleCarRequest(request, "POST")
}

export async function PUT(request) {
  return handleCarRequest(request, "PUT")
}

async function handleCarRequest(request, method) {
  try {
    const client = await clientPromise
    const db = client.db("parking")

    const contentType = request.headers.get("content-type") || ""
    let carData
    let carId
    let isUpdate = false

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      carId = formData.get("carId")?.toString()
      isUpdate = method === "PUT" && carId

      carData = {
        placa: formData.get("placa")?.toString().toUpperCase() || "",
        marca: formData.get("marca")?.toString() || "",
        modelo: formData.get("modelo")?.toString() || "",
        color: formData.get("color")?.toString() || "",
        nombreDueño: formData.get("nombreDueño")?.toString() || "",
        telefono: formData.get("telefono")?.toString() || "",
        ticketAsociado: formData.get("ticketAsociado")?.toString() || "",
        nota: formData.get("nota")?.toString() || "",
      }

      const plateImage = formData.get("plateImage") as File | null
      const vehicleImage = formData.get("vehicleImage") as File | null
      const plateImageUrl = formData.get("plateImageUrl")?.toString()
      const vehicleImageUrl = formData.get("vehicleImageUrl")?.toString()

      if (plateImage || vehicleImage || plateImageUrl || vehicleImageUrl) {
        carData.imagenes = {
          fechaCaptura: new Date(),
          capturaMetodo: "manual",
        }

        if (plateImage) {
          const plateUploadResponse = await cloudinary.uploader.upload(
            `data:image/jpeg;base64,${await plateImage.arrayBuffer().then(Buffer.from).toString("base64")}`,
            { folder: "parking-plates" },
          )
          carData.imagenes.plateImageUrl = plateUploadResponse.secure_url
        } else if (plateImageUrl) {
          carData.imagenes.plateImageUrl = plateImageUrl
        }

        if (vehicleImage) {
          const vehicleUploadResponse = await cloudinary.uploader.upload(
            `data:image/jpeg;base64,${await vehicleImage.arrayBuffer().then(Buffer.from).toString("base64")}`,
            { folder: "parking-vehicles" },
          )
          carData.imagenes.vehicleImageUrl = vehicleUploadResponse.secure_url
        } else if (vehicleImageUrl) {
          carData.imagenes.vehicleImageUrl = vehicleImageUrl
        }
      }
    } else {
      const jsonData = await request.json()
      carId = jsonData.carId
      isUpdate = method === "PUT" && carId

      carData = {
        placa: (jsonData.placa || "").toString().toUpperCase(),
        marca: jsonData.marca || "",
        modelo: jsonData.modelo || "",
        color: jsonData.color || "",
        nombreDueño: jsonData.nombreDueño || "",
        telefono: jsonData.telefono || "",
        ticketAsociado: jsonData.ticketAsociado || "",
        nota: jsonData.nota || "",
      }

      if (jsonData.imagenes) {
        carData.imagenes = {
          ...jsonData.imagenes,
          fechaCaptura: new Date(),
        }
      }
    }

    console.log(`${method} request received`, { carId, ...carData })

    if (!carData.placa || !carData.ticketAsociado) {
      return NextResponse.json({ error: "Placa y ticket son campos obligatorios" }, { status: 400 })
    }

    let existingCar
    if (isUpdate) {
      existingCar = await db.collection("cars").findOne({ _id: new ObjectId(carId) })
      if (!existingCar) {
        return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
      }
    }

    if (!isUpdate || (isUpdate && existingCar.ticketAsociado !== carData.ticketAsociado)) {
      console.log(`🎫 DEBUG: Verificando disponibilidad del ticket: ${carData.ticketAsociado}`)
      const ticketCheck = await db.collection("tickets").findOne({
        codigoTicket: carData.ticketAsociado,
      })

      if (!ticketCheck) {
        console.log(`🎫 DEBUG: Ticket ${carData.ticketAsociado} no existe`)
        return NextResponse.json({ error: `El ticket ${carData.ticketAsociado} no existe` }, { status: 400 })
      }

      if (ticketCheck.estado !== "disponible") {
        console.log(
          `🎫 DEBUG: Ticket ${carData.ticketAsociado} no está disponible. Estado actual: ${ticketCheck.estado}`,
        )
        return NextResponse.json(
          { error: `El ticket ${carData.ticketAsociado} ya está ocupado o no está disponible` },
          { status: 400 },
        )
      }

      if (ticketCheck.carInfo && ticketCheck.carInfo !== null) {
        console.log(`🎫 DEBUG: Ticket ${carData.ticketAsociado} ya tiene información de carro asociada`)
        return NextResponse.json(
          { error: `El ticket ${carData.ticketAsociado} ya tiene un vehículo asignado` },
          { status: 400 },
        )
      }

      console.log(`🎫 DEBUG: Ticket ${carData.ticketAsociado} está disponible para asignación`)
    }

    const now = new Date()
    const finalCarData = {
      ...carData,
      horaIngreso: isUpdate ? existingCar.horaIngreso : now,
      estado: isUpdate ? existingCar.estado : "estacionado",
      fechaRegistro: isUpdate ? existingCar.fechaRegistro : now,
      lastModified: now,
    }

    if (!finalCarData.imagenes) {
      finalCarData.imagenes = {
        fechaCaptura: now,
        capturaMetodo: "manual",
      }
    }

    let result
    if (isUpdate) {
      console.log("Updating car...")
      result = await db.collection("cars").updateOne({ _id: new ObjectId(carId) }, { $set: finalCarData })
      console.log(`Car update result:`, result)
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
      }
    } else {
      console.log("Inserting new car...")
      result = await db.collection("cars").insertOne(finalCarData)
      finalCarData._id = result.insertedId
      console.log(`Car inserted: ${result.insertedId}`)

      if (carData.ticketAsociado) {
        console.log(`🎫 DEBUG: Actualizando ticket ${carData.ticketAsociado} a estado ocupado`)
        const updateResult = await db.collection("tickets").updateOne(
          {
            codigoTicket: carData.ticketAsociado,
            estado: "disponible",
          },
          {
            $set: {
              estado: "ocupado",
              carInfo: {
                _id: result.insertedId,
                placa: carData.placa,
                marca: carData.marca,
                modelo: carData.modelo,
                color: carData.color,
                nombreDueño: carData.nombreDueño,
                telefono: carData.telefono,
                horaIngreso: now.toISOString(),
                fechaRegistro: now.toISOString(),
                imagenes: finalCarData.imagenes,
                nota: carData.nota,
              },
              horaOcupacion: now.toISOString(),
            },
          },
        )

        console.log(`Ticket update result:`, updateResult)

        if (updateResult.matchedCount === 0) {
          console.log(`🎫 DEBUG: No se pudo actualizar el ticket ${carData.ticketAsociado}, revirtiendo inserción`)
          await db.collection("cars").deleteOne({ _id: result.insertedId })
          return NextResponse.json(
            { error: `El ticket ${carData.ticketAsociado} ya no está disponible` },
            { status: 400 },
          )
        }

        console.log("🎫 DEBUG - Ticket actualizado exitosamente:", carData.ticketAsociado, updateResult)

        console.log(`🔔 [CARS] Enviando notificación a administradores para ticket ${carData.ticketAsociado}`)
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "vehicle_registered",
            userType: "admin",
            ticketCode: carData.ticketAsociado,
            data: {
              plate: carData.placa,
              timestamp: now.toISOString(),
            },
          }),
        })
          .then(async (notificationResponse) => {
            console.log(`Notification response status: ${notificationResponse.status}`)
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
          })
          .catch((notificationError) => {
            console.error(`⚠️ [CARS] Error de red al enviar notificación: ${notificationError.message}`)
          })

        console.log("Updating admin subscriptions...")
        const adminSubscriptions = await db
          .collection("ticket_subscriptions")
          .find({ userType: "admin", isActive: true })
          .toArray()
        console.log(`Found ${adminSubscriptions.length} admin subscriptions`)

        if (adminSubscriptions.length > 0) {
          const updatePromises = adminSubscriptions.map(async (sub) => {
            const currentTicketCodes = sub.ticketCodes || []
            if (!currentTicketCodes.includes(carData.ticketAsociado)) {
              currentTicketCodes.push(carData.ticketAsociado)
              const updateResult = await db
                .collection("ticket_subscriptions")
                .updateOne({ _id: sub._id }, { $set: { ticketCodes: currentTicketCodes } })
              console.log(`Subscription ${sub._id} updated with ticket ${carData.ticketAsociado}:`, updateResult)
            }
          })
          await Promise.all(updatePromises)
        }

        console.log("Creating history entry...")
        const historyEntry = {
          carId: result.insertedId.toString(),
          placa: finalCarData.placa || "PENDIENTE",
          marca: finalCarData.marca || "Por definir",
          modelo: finalCarData.modelo || "Por definir",
          color: finalCarData.color || "Por definir",
          nombreDueño: finalCarData.nombreDueño || "Por definir",
          telefono: finalCarData.telefono || "Por definir",
          ticketAsociado: finalCarData.ticketAsociado || "",
          estadoActual: "estacionado",
          activo: true,
          completado: false,
          fechaRegistro: now,
          fechaUltimaActualizacion: now,
          datosVehiculo: { ...finalCarData, fechaCreacion: now },
          eventos: [
            {
              tipo: "registro_inicial",
              fecha: now,
              estado: "estacionado",
              datos: {
                metodoRegistro: finalCarData.imagenes?.capturaMetodo || "manual",
                imagenes: finalCarData.imagenes || null,
                nota: finalCarData.nota || "",
              },
            },
          ],
          pagos: [],
          pagosRechazados: [],
          montosPendientes: [],
          montoTotalPagado: 0,
        }
        const historyResult = await db.collection("car_history").insertOne(historyEntry)
        console.log(`History entry created: ${historyResult.insertedId}`)
      }
    }

    console.log("Fetching updated car...")
    const updatedCar = await db.collection("cars").findOne({
      _id: isUpdate ? new ObjectId(carId) : result.insertedId,
    })
    console.log("Updated car fetched:", updatedCar)

    // Trigger stats update event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("statsUpdate"))
    }

    return NextResponse.json({
      success: true,
      message: isUpdate ? "Vehículo actualizado correctamente" : "Vehículo registrado correctamente",
      car: updatedCar,
    })
  } catch (error) {
    console.error("Error handling car request:", {
      message: error.message,
      stack: error.stack,
      requestMethod: method,
    })
    return NextResponse.json(
      {
        error: error.message || "Error interno del servidor",
      },
      { status: 500 },
    )
  }
}
