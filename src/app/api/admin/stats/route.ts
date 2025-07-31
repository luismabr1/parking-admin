import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("parking");

    // Verificar existencia de colecciones
    const collections = ["pagos", "tickets", "staff", "cars"];
    const existingCollections = await db.listCollections().toArray();
    const validCollections = collections.every((col) =>
      existingCollections.some((c) => c.name === col)
    );
    if (!validCollections) {
      throw new Error("Alguna colección requerida no existe");
    }

    // Obtener estadísticas de pagos pendientes
    const pendingPayments = await db.collection("pagos").countDocuments({
      estado: "pendiente_validacion",
    });

    // Obtener confirmaciones pendientes (ajustar estado si es necesario)
    const pendingConfirmations = await db.collection("tickets").countDocuments({
      estado: "ocupado", // Cambiar a estado correcto si aplica
    });

    // Obtener total de personal
    const totalStaff = await db.collection("staff").countDocuments();

    // Obtener pagos de hoy en UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const todayPayments = await db.collection("pagos").countDocuments({
      fechaPago: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // Obtener estadísticas de tickets
    const totalTickets = await db.collection("tickets").countDocuments();
    const availableTickets = await db.collection("tickets").countDocuments({
      estado: "disponible",
    });

    // Obtener carros estacionados actualmente
    const carsParked = await db.collection("cars").countDocuments({
      estado: { $in: ["estacionado", "estacionado_confirmado", "pago_pendiente"] },
    });
    console.log("🔍 DEBUG: Cars parked count:", carsParked);

    // Obtener tickets pagados listos para salir
    const paidTickets = await db.collection("tickets").countDocuments({
      estado: "pagado_validado",
    });

    const response = NextResponse.json({
      pendingPayments,
      pendingConfirmations,
      totalStaff,
      todayPayments,
      totalTickets,
      availableTickets,
      carsParked,
      paidTickets,
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");

    return response;
  } catch (error) {
    console.error("🔍 DEBUG: Error fetching stats:", error);
    return NextResponse.json({ message: "Error al obtener estadísticas" }, { status: 500 });
  }
}