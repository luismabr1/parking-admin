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
    if (process.env.NODE_ENV === "development") {
      console.error("Error fetching cars:", error)
    }
    return NextResponse.json({ message: "Error al obtener carros" }, { status: 500 })
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

    // Manejar tanto FormData como JSON
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

    if (process.env.NODE_ENV === "development") {
      console.log(`${method} request received`, { carId, ...carData })
    }

    if (!carData.placa || !carData.ticketAsociado) {
      return NextResponse.json(
        {
          error: "Placa y ticket son campos obligatorios",
        },
        { status: 400 },
      )
    }

    let existingCar
    if (isUpdate) {
      existingCar = await db.collection("cars").findOne({ _id: new ObjectId(carId) })
      if (!existingCar) {
        return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
      }
    }

    if (!isUpdate || (isUpdate && existingCar.ticketAsociado !== carData.ticketAsociado)) {
      if (process.env.NODE_ENV === "development") {
        console.log(`🎫 DEBUG: Verificando disponibilidad del ticket: ${carData.ticketAsociado}`)
      }

      const ticketCheck = await db.collection("tickets").findOne({
        codigoTicket: carData.ticketAsociado,
      })

      if (!ticketCheck) {
        if (process.env.NODE_ENV === "development") {
          console.log(`🎫 DEBUG: Ticket ${carData.ticketAsociado} no existe`)
        }
        return NextResponse.json({ error: `El ticket ${carData.ticketAsociado} no existe` }, { status: 400 })
      }

      if (ticketCheck.estado !== "disponible") {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `🎫 DEBUG: Ticket ${carData.ticketAsociado} no está disponible. Estado actual: ${ticketCheck.estado}`,
          )
        }
        return NextResponse.json(
          { error: `El ticket ${carData.ticketAsociado} ya está ocupado o no está disponible` },
          { status: 400 },
        )
      }

      if (ticketCheck.carInfo && ticketCheck.carInfo !== null) {
        if (process.env.NODE_ENV === "development") {
          console.log(`🎫 DEBUG: Ticket ${carData.ticketAsociado} ya tiene información de carro asociada`)
        }
        return NextResponse.json(
          { error: `El ticket ${carData.ticketAsociado} ya tiene un vehículo asignado` },
          { status: 400 },
        )
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`🎫 DEBUG: Ticket ${carData.ticketAsociado} está disponible para asignación`)
      }
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
      result = await db.collection("cars").updateOne({ _id: new ObjectId(carId) }, { $set: finalCarData })
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
      }
    } else {
      result = await db.collection("cars").insertOne(finalCarData)
      finalCarData._id = result.insertedId

      if (carData.ticketAsociado) {
        if (process.env.NODE_ENV === "development") {
          console.log(`🎫 DEBUG: Actualizando ticket ${carData.ticketAsociado} a estado ocupado`)
        }

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

        if (updateResult.matchedCount === 0) {
          await db.collection("cars").deleteOne({ _id: result.insertedId })
          if (process.env.NODE_ENV === "development") {
            console.log(`🎫 DEBUG: No se pudo actualizar el ticket ${carData.ticketAsociado}, revirtiendo inserción`)
          }
          return NextResponse.json(
            { error: `El ticket ${carData.ticketAsociado} ya no está disponible` },
            { status: 400 },
          )
        }

        if (process.env.NODE_ENV === "development") {
          console.log("🎫 DEBUG - Ticket actualizado exitosamente:", carData.ticketAsociado, updateResult)
        }

        // Enviar notificación al equipo administrativo
        if (updateResult.modifiedCount > 0) {
          console.log(`🔔 [CARS] Enviando notificación a administradores para ticket ${carData.ticketAsociado}`)
          const notificationResponse = await fetch("http://localhost:3000/api/send-notification", {
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

          // Actualizar suscripciones de administradores con el nuevo ticketCode
          const adminSubscriptions = await db
            .collection("ticket_subscriptions")
            .find({ userType: "admin", isActive: true })
            .toArray()

          if (adminSubscriptions.length > 0) {
            const updatePromises = adminSubscriptions.map(async (sub) => {
              const currentTicketCodes = sub.ticketCodes || []
              if (!currentTicketCodes.includes(carData.ticketAsociado)) {
                currentTicketCodes.push(carData.ticketAsociado)
                await db.collection("ticket_subscriptions").updateOne(
                  { _id: sub._id },
                  { $set: { ticketCodes: currentTicketCodes } }
                )
                console.log(`🔔 [CARS] Suscripción ${sub._id} actualizada con ticket ${carData.ticketAsociado}`)
              }
            })
            await Promise.all(updatePromises)
          }
        }
      }

      // Crear entrada en historial
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
      await db.collection("car_history").insertOne(historyEntry)
    }

    const updatedCar = await db.collection("cars").findOne({
      _id: isUpdate ? new ObjectId(carId) : result.insertedId,
    })

    return NextResponse.json({
      success: true,
      message: isUpdate ? "Vehículo actualizado correctamente" : "Vehículo registrado correctamente",
      car: updatedCar,
    })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error handling car request:", error)
    }
    return NextResponse.json(
      {
        error: error.message || "Error interno del servidor",
      },
      { status: 500 },
    )
  }
}