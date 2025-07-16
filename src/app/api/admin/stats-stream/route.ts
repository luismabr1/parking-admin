import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const client = await clientPromise;
  const db = client.db("parking");

  // Configurar Change Streams para las colecciones relevantes
  const collections = ["tickets", "pagos", "cars"];
  const changeStreams = collections.map((collection) =>
    db.collection(collection).watch([], { fullDocument: "updateLookup" })
  );

  // Enviar headers SSE
  const stream = new ReadableStream({
    start(controller) {
      let isStreamActive = true; // Flag to track stream state

      const sendStats = async () => {
        if (!isStreamActive) return; // Do nothing if stream is closed
        try {
          const stats = await calculateStats(db);
          controller.enqueue(`data: ${JSON.stringify(stats)}\n\n`);
        } catch (error) {
          console.error("Error calculating stats:", error);
          controller.enqueue(`data: ${JSON.stringify({ error: "Error calculating stats" })}\n\n`);
        }
      };

      // Enviar estadísticas iniciales
      sendStats();

      // Escuchar cambios en las colecciones
      changeStreams.forEach((changeStream) => {
        changeStream.on("change", async (change) => {
          console.log("🔍 DEBUG: Cambio detectado:", change.operationType, change.ns.coll);
          await sendStats(); // Recalcular y enviar stats al detectar un cambio
        });

        changeStream.on("error", (error) => {
          console.error("Change Stream error:", error);
          controller.error(error); // This will close the stream
          isStreamActive = false;
        });

        changeStream.on("end", () => {
          console.log("Change Stream ended");
          controller.close(); // Close the stream
          isStreamActive = false;
        });
      });
    },
    cancel() {
      changeStreams.forEach((stream) => stream.close());
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// Función para calcular estadísticas
async function calculateStats(db: any) {
  const pendingPayments = await db.collection("pagos").countDocuments({
    estado: "pendiente_validacion",
  });

  const pendingConfirmations = await db.collection("tickets").countDocuments({
    estado: "ocupado", // Ajusta según tu estado
  });

  const totalStaff = await db.collection("staff").countDocuments();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const todayPayments = await db.collection("pagos").countDocuments({
    fechaPago: { $gte: today, $lt: tomorrow },
  });

  const totalTickets = await db.collection("tickets").countDocuments();
  const availableTickets = await db.collection("tickets").countDocuments({
    estado: "disponible",
  });

  const carsParked = await db.collection("cars").countDocuments({
    estado: { $in: ["estacionado", "estacionado_confirmado", "pago_pendiente"] },
  });

  const paidTickets = await db.collection("tickets").countDocuments({
    estado: "pagado_validado",
  });

  return {
    pendingPayments,
    pendingConfirmations,
    totalStaff,
    todayPayments,
    totalTickets,
    availableTickets,
    carsParked,
    paidTickets,
  };
}