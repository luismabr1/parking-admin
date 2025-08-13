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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Salida Rápida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del vehículo */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              {/* Placeholder for Car icon */}
              <span className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-lg">{car.placa}</span>
              <Badge variant="secondary">{car.estado === "estacionado_confirmado" ? "Confirmado" : "Pendiente"}</Badge>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
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
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  <span className="text-blue-600 font-medium">📝 {car.nota}</span>
                </div>
              )}
            </div>
          </div>

          {/* Alerta informativa */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Salida Rápida:</strong> Esta acción liberará inmediatamente el espacio de estacionamiento sin
              requerir pago. Se registrará en el historial como "salida_rapida".
            </AlertDescription>
          </Alert>

          {/* Campo de nota obligatoria */}
          <div className="space-y-2">
            <Label htmlFor="exitNote" className="text-sm font-medium">
              Nota de Salida (Obligatoria) *
            </Label>
            <Textarea
              id="exitNote"
              value={exitNote}
              onChange={(e) => setExitNote(e.target.value)}
              placeholder="Explique el motivo de la salida rápida (ej: emergencia médica, problema técnico, cortesía, etc.)"
              className="min-h-[80px] resize-none"
              disabled={isProcessing}
            />
            <p className="text-xs text-gray-500">Mínimo 10 caracteres. Esta nota se guardará en el historial.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !exitNote.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isProcessing ? "Procesando..." : "Confirmar Salida Rápida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
