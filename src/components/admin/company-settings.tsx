"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Clock, Sun, Moon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Bank {
  _id: string
  code: string
  name: string
}

export default function AdminCompanySettings() {
  const [settings, setSettings] = useState({
    pagoMovil: {
      banco: "",
      cedula: "",
      telefono: "",
    },
    transferencia: {
      banco: "",
      cedula: "",
      telefono: "",
      numeroCuenta: "",
    },
    tarifas: {
      precioHoraDiurno: 3.0,
      precioHoraNocturno: 4.0,
      tasaCambio: 35.0,
      horaInicioNocturno: "00:00",
      horaFinNocturno: "06:00",
    },
  })

  const [displayValues, setDisplayValues] = useState({
    precioHoraDiurno: "3,00",
    precioHoraNocturno: "4,00",
    tasaCambio: "35,00",
  })

  const [banks, setBanks] = useState<Bank[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [alertVariant, setAlertVariant] = useState<"default" | "destructive" | "warning">("default")

  useEffect(() => {
    Promise.all([fetchSettings(), fetchBanks()])
      .then(() => {
        setIsLoading(false)
      })
      .catch((error) => {
        console.error("Error initializing:", error)
        setIsLoading(false)
      })
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/company-settings", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const { _id, ...settingsWithoutId } = data
      setSettings(settingsWithoutId)

      setDisplayValues({
        precioHoraDiurno: formatNumberForDisplay(settingsWithoutId.tarifas.precioHoraDiurno),
        precioHoraNocturno: formatNumberForDisplay(settingsWithoutId.tarifas.precioHoraNocturno),
        tasaCambio: formatNumberForDisplay(settingsWithoutId.tarifas.tasaCambio),
      })
    } catch (err) {
      console.error("Error fetching settings:", err)
      setMessage("Error al cargar la configuración")
      setAlertVariant("destructive")
    }
  }

  const fetchBanks = async () => {
    try {
      const response = await fetch("/api/banks", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setBanks(data)
    } catch (err) {
      console.error("Error fetching banks:", err)
    }
  }

  const formatNumberForDisplay = (num: number): string => {
    return num.toFixed(2).replace(".", ",")
  }

  const parseNumberFromText = (text: string): number => {
    const normalizedText = text.replace(",", ".")
    const parsed = Number.parseFloat(normalizedText)
    return isNaN(parsed) ? 0 : Number.parseFloat(parsed.toFixed(2))
  }

  const isValidNumberInput = (text: string): boolean => {
    const regex = /^[0-9]*[,.]?[0-9]*$/
    return regex.test(text) && (text.match(/[,.]/g) || []).length <= 1
  }

  const isValidTimeInput = (text: string): boolean => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    return regex.test(text)
  }

  const updateTarifas = (field: string, value: string) => {
    if (!isValidNumberInput(value)) {
      return
    }

    setDisplayValues((prev) => ({
      ...prev,
      [field]: value,
    }))

    const numValue = parseNumberFromText(value)
    setSettings((prev) => ({
      ...prev,
      tarifas: { ...prev.tarifas, [field]: numValue },
    }))
  }

  const handleTarifaBlur = (field: string, value: string) => {
    const numValue = parseNumberFromText(value)
    const formattedValue = formatNumberForDisplay(numValue)

    setDisplayValues((prev) => ({
      ...prev,
      [field]: formattedValue,
    }))

    setSettings((prev) => ({
      ...prev,
      tarifas: { ...prev.tarifas, [field]: numValue },
    }))
  }

  const updateHorario = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      tarifas: { ...prev.tarifas, [field]: value },
    }))
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSaving(true)
  setMessage("")

  if (!isValidTimeInput(settings.tarifas.horaInicioNocturno) || !isValidTimeInput(settings.tarifas.horaFinNocturno)) {
    setMessage("Formato de hora inválido. Use HH:mm (ej: 00:00)")
    setAlertVariant("destructive")
    setIsSaving(false)
    return
  }

  try {
    const settingsToSend = {
      pagoMovil: { ...settings.pagoMovil },
      transferencia: { ...settings.transferencia },
      tarifas: { ...settings.tarifas },
    }

    console.log("Sending settings:", JSON.stringify(settingsToSend, null, 2))
    const response = await fetch("/api/admin/company-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(settingsToSend),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log("Server response:", errorText)
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const result = await response.json()
    setMessage(result.message || "Configuración guardada exitosamente")
    setAlertVariant("default")
  } catch (err) {
    console.error("Error submitting settings:", err)
    setMessage(err instanceof Error ? err.message : "Error al guardar la configuración")
    setAlertVariant("destructive")
  } finally {
    setIsSaving(false)
  }
}

  const updatePagoMovil = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      pagoMovil: { ...prev.pagoMovil, [field]: value },
    }))
  }

  const updateTransferencia = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      transferencia: { ...prev.transferencia, [field]: value },
    }))
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Opciones de Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Cargando configuración...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Opciones de Pago de la Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {message && (
            <Alert variant={alertVariant}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Pago Móvil</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pagoMovilBanco">Banco (Pago Móvil)</Label>
                <Select value={settings.pagoMovil.banco} onValueChange={(value) => updatePagoMovil("banco", value)}>
                  <SelectTrigger id="pagoMovilBanco">
                    <SelectValue placeholder="Seleccione un banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={`pm-${bank.code}`} value={bank.name}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pagoMovilCedula">Cédula o RIF (Pago Móvil)</Label>
                <Input
                  id="pagoMovilCedula"
                  value={settings.pagoMovil.cedula}
                  onChange={(e) => updatePagoMovil("cedula", e.target.value)}
                  placeholder="Ej. V-12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pagoMovilTelefono">Teléfono (Pago Móvil)</Label>
                <Input
                  id="pagoMovilTelefono"
                  value={settings.pagoMovil.telefono}
                  onChange={(e) => updatePagoMovil("telefono", e.target.value)}
                  placeholder="Ej. 0414-1234567"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Transferencia Bancaria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transferenciaBanco">Banco (Transferencia)</Label>
                <Select
                  value={settings.transferencia.banco}
                  onValueChange={(value) => updateTransferencia("banco", value)}
                >
                  <SelectTrigger id="transferenciaBanco">
                    <SelectValue placeholder="Seleccione un banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={`tr-${bank.code}`} value={bank.name}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transferenciaCedula">Cédula o RIF (Transferencia)</Label>
                <Input
                  id="transferenciaCedula"
                  value={settings.transferencia.cedula}
                  onChange={(e) => updateTransferencia("cedula", e.target.value)}
                  placeholder="Ej. J-12345678-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transferenciaTelefono">Teléfono (Transferencia)</Label>
                <Input
                  id="transferenciaTelefono"
                  value={settings.transferencia.telefono}
                  onChange={(e) => updateTransferencia("telefono", e.target.value)}
                  placeholder="Ej. 0212-1234567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transferenciaCuenta">Número de Cuenta</Label>
                <Input
                  id="transferenciaCuenta"
                  value={settings.transferencia.numeroCuenta}
                  onChange={(e) => updateTransferencia("numeroCuenta", e.target.value)}
                  placeholder="Ej. 0102-0000-00-0000000000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Configuración de Tarifas
            </h3>

            {/* Tarifas Diurnas y Nocturnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tarifa Diurna */}
              <div className="space-y-4 p-4 border rounded-lg bg-yellow-50">
                <div className="flex items-center gap-2 text-lg font-medium text-yellow-800">
                  <Sun className="h-5 w-5" />
                  Tarifa Diurna
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioHoraDiurno">Precio por Hora (USD)</Label>
                  <Input
                    id="precioHoraDiurno"
                    type="text"
                    value={displayValues.precioHoraDiurno}
                    onChange={(e) => updateTarifas("precioHoraDiurno", e.target.value)}
                    onBlur={(e) => handleTarifaBlur("precioHoraDiurno", e.target.value)}
                    placeholder="Ej. 3,00"
                  />
                  <p className="text-xs text-gray-600">Tarifa aplicada durante el día. Use coma (,) para decimales.</p>
                </div>
              </div>

              {/* Tarifa Nocturna */}
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 text-lg font-medium text-blue-800">
                  <Moon className="h-5 w-5" />
                  Tarifa Nocturna
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioHoraNocturno">Precio por Hora (USD)</Label>
                  <Input
                    id="precioHoraNocturno"
                    type="text"
                    value={displayValues.precioHoraNocturno}
                    onChange={(e) => updateTarifas("precioHoraNocturno", e.target.value)}
                    onBlur={(e) => handleTarifaBlur("precioHoraNocturno", e.target.value)}
                    placeholder="Ej. 4,00"
                  />
                  <p className="text-xs text-gray-600">
                    Tarifa aplicada durante la noche. Use coma (,) para decimales.
                  </p>
                </div>
              </div>
            </div>

            {/* Configuración de Horario Nocturno */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium text-gray-800">Horario Nocturno</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="horaInicioNocturno">Hora de Inicio</Label>
                  <Input
                    id="horaInicioNocturno"
                    type="time"
                    value={settings.tarifas.horaInicioNocturno}
                    onChange={(e) => updateHorario("horaInicioNocturno", e.target.value)}
                    placeholder="00:00"
                  />
                  <p className="text-xs text-gray-600">Hora en que inicia la tarifa nocturna</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horaFinNocturno">Hora de Fin</Label>
                  <Input
                    id="horaFinNocturno"
                    type="time"
                    value={settings.tarifas.horaFinNocturno}
                    onChange={(e) => updateHorario("horaFinNocturno", e.target.value)}
                    placeholder="06:00"
                  />
                  <p className="text-xs text-gray-600">Hora en que termina la tarifa nocturna</p>
                </div>
              </div>
            </div>

            {/* Tasa de Cambio */}
            <div className="space-y-2">
              <Label htmlFor="tasaCambio">Tasa de Cambio (Bs. por USD)</Label>
              <Input
                id="tasaCambio"
                type="text"
                value={displayValues.tasaCambio}
                onChange={(e) => updateTarifas("tasaCambio", e.target.value)}
                onBlur={(e) => handleTarifaBlur("tasaCambio", e.target.value)}
                placeholder="Ej. 35,20"
              />
              <p className="text-xs text-gray-500">
                Tasa de conversión de dólares a bolívares. Use coma (,) para decimales.
              </p>
            </div>

            {/* Vista previa */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Vista previa de tarifas:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-600" />
                  <div>
                    <span className="text-gray-600">Diurna:</span>
                    <span className="font-medium ml-2">${settings.tarifas.precioHoraDiurno.toFixed(2)}/h</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-blue-600" />
                  <div>
                    <span className="text-gray-600">Nocturna:</span>
                    <span className="font-medium ml-2">${settings.tarifas.precioHoraNocturno.toFixed(2)}/h</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Tasa:</span>
                  <span className="font-medium ml-2">{formatNumberForDisplay(settings.tarifas.tasaCambio)} Bs/USD</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Horario nocturno: {settings.tarifas.horaInicioNocturno} - {settings.tarifas.horaFinNocturno}
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-lg" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}