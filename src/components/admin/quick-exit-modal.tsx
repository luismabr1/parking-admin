"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Clock, Zap, AlertTriangle } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useMobileDetection } from "@/hooks/use-mobile-detection"

interface QuickExitModalProps {
  car: {
    _id: string
    placa: string
    marca: string
    modelo: string
    color: string
    nombreDueño: string
    telefono: string
    ticketAsociado: string
    horaIngreso: string
    estado: string
    nota?: string
  }
  isOpen: boolean
  onClose: () => void
  onConfirm: (exitNote: string) => Promise<void>
  isProcessing: boolean
}

export default function QuickExitModal({ car, isOpen, onClose, onConfirm, isProcessing }: QuickExitModalProps) {
  const [exitNote, setExitNote] = useState("")
  const [error, setError] = useState("")
  const isMobile = useMobileDetection()

  const handleSubmit = async () => {
    if (!exitNote.trim()) {
      setError("La nota de salida es obligatoria")
      return
    }

    if (exitNote.trim().length < 10) {
      setError("La nota debe tener al menos 10 caracteres")
      return
    }

    setError("")
    try {
      await onConfirm(exitNote.trim())
      setExitNote("")
    } catch (err) {
      setError("Error al procesar la salida rápida")
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setExitNote("")
      setError("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={`overflow-hidden ${isMobile ? "flex flex-col max-h-[calc(100vh-2rem)]" : "sm:max-w-md"}`}
      >
        <DialogHeader className={isMobile ? "pb-3 flex-shrink-0" : ""}>
          <DialogTitle className={`flex items-center gap-2 ${isMobile ? "text-lg" : ""}`}>
            <Zap className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} text-orange-500`} />
            Salida Rápida
          </DialogTitle>
        </DialogHeader>

        <div className={`space-y-4 ${isMobile ? "space-y-3 flex-1 overflow-y-auto" : ""}`}>
          {/* Información del vehículo */}
          <div className={`bg-gray-50 rounded-lg space-y-2 ${isMobile ? "p-3" : "p-4"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-4 w-4 text-blue-600" />
              <span className={`font-semibold ${isMobile ? "text-base" : "text-lg"}`}>{car.placa}</span>
              <Badge variant="secondary" className={isMobile ? "text-xs" : ""}>
                {car.estado === "estacionado_confirmado" ? "Confirmado" : "Pendiente"}
              </Badge>
            </div>

            <div className={`text-gray-600 space-y-1 ${isMobile ? "text-xs" : "text-sm"}`}>
              <p>
                <strong>Vehículo:</strong> {car.marca} {car.modelo} - {car.color}
              </p>
              <p>
                <strong>Propietario:</strong> {car.nombreDueño}
              </p>
              <p>
                <strong>Teléfono:</strong> {car.telefono}
              </p>
              <p>
                <strong>Ticket:</strong> {car.ticketAsociado}
              </p>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Ingreso: {formatDateTime(car.horaIngreso)}</span>
              </div>
              {car.nota && (
                <div className={`mt-2 bg-blue-50 rounded ${isMobile ? "p-2 text-xs" : "p-2 text-sm"}`}>
                  <span className="text-blue-600 font-medium">📝 {car.nota}</span>
                </div>
              )}
            </div>
          </div>

          {/* Alerta informativa */}
          <Alert className={isMobile ? "p-2" : "p-4"}>
            <AlertTriangle className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
            <AlertDescription className={isMobile ? "text-xs" : "text-sm"}>
              <strong>Salida Rápida:</strong> Esta acción liberará inmediatamente el espacio de estacionamiento sin
              requerir pago. Se registrará en el historial como "salida_rapida".
            </AlertDescription>
          </Alert>

          {/* Campo de nota obligatoria */}
          <div className="space-y-2">
            <Label htmlFor="exitNote" className={`font-medium ${isMobile ? "text-sm" : "text-base"}`}>
              Nota de Salida (Obligatoria) *
            </Label>
            <Textarea
              id="exitNote"
              value={exitNote}
              onChange={(e) => setExitNote(e.target.value)}
              placeholder="Explique el motivo de la salida rápida (ej: emergencia médica, problema técnico, cortesía, etc.)"
              className={`resize-none ${isMobile ? "min-h-[60px] text-sm" : "min-h-[80px] text-base"}`}
              disabled={isProcessing}
            />
            <p className={`text-gray-500 ${isMobile ? "text-xs" : "text-sm"}`}>
              Mínimo 10 caracteres. Esta nota se guardará en el historial.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className={isMobile ? "p-2" : "p-4"}>
              <AlertDescription className={isMobile ? "text-xs" : "text-sm"}>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className={`flex gap-2 ${isMobile ? "flex-col-reverse space-y-2" : "justify-end"}`}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className={isMobile ? "w-full" : "min-w-[100px]"}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !exitNote.trim()}
            className={`bg-orange-600 hover:bg-orange-700 text-white ${isMobile ? "w-full" : "min-w-[150px]"}`}
          >
            <Zap className="h-4 w-4 mr-2" />
            {isProcessing ? "Procesando..." : "Confirmar Salida Rápida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
