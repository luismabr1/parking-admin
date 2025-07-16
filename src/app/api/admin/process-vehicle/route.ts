import { NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ❌ ELIMINADO: Configuración de OCR - ya no se usa procesamiento de texto en imágenes
// const OCR_CONFIG = { ... }

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const image = formData.get("image") as File
    const type = formData.get("type") as string // "plate" o "vehicle"
    // ❌ ELIMINADO: method parameter - ya no se necesita método de OCR
    // const method = formData.get("method") as string || "auto"

    if (!image) {
      return NextResponse.json({ success: false, message: "No se recibió imagen" }, { status: 400 })
    }

    console.log(`📤 Subiendo imagen de ${type}`)
    const startTime = Date.now()

    // Convertir imagen a buffer
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Configurar transformaciones según el tipo
    const transformations =
      type === "plate"
        ? [
            { width: 800, height: 400, crop: "limit" },
            { quality: "auto" },
            { effect: "sharpen" },
            { effect: "contrast:30" },
          ]
        : [{ width: 1200, height: 800, crop: "limit" }, { quality: "auto" }, { effect: "auto_contrast" }]

    // Subir imagen a Cloudinary
    console.log("📤 Subiendo imagen a Cloudinary...")
    const uploadResponse = (await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "image",
            folder: `parking-${type}s`,
            transformation: transformations,
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          },
        )
        .end(buffer)
    })) as any

    console.log(`✅ Imagen subida: ${uploadResponse.secure_url}`)

    const processingTime = Date.now() - startTime

    // ❌ ELIMINADO: Procesamiento de OCR - ahora solo devolvemos la URL de la imagen subida
    // const result = await processPlateWithOCR(uploadResponse.secure_url, method)
    // const result = await processVehicleWithOCR(uploadResponse.secure_url, method)

    // Respuesta simplificada sin datos de OCR
    return NextResponse.json({
      success: true,
      imageUrl: uploadResponse.secure_url,
      processingTime,
      type: type,
      uploadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("💥 Error processing vehicle:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error al procesar la imagen",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    )
  }
}

// ❌ ELIMINADO: Todas las funciones de OCR ya no son necesarias
// async function processPlateWithOCR(imageUrl: string, preferredMethod: string) { ... }
// async function processVehicleWithOCR(imageUrl: string, preferredMethod: string) { ... }
// async function processPythonAPIPlate(imageUrl: string) { ... }
// async function processPythonAPIVehicle(imageUrl: string) { ... }
// async function simulatePlateRecognition() { ... }
// async function simulateVehicleRecognition() { ... }
// function generateRandomPlate(): string { ... }
