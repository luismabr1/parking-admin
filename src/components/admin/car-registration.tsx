"use client"

import type React from "react"
import { memo, useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CarIcon, RefreshCw, Plus, Camera, Smartphone, Monitor, ImageIcon, Edit, Eye } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import { useMobileDetection } from "@/hooks/use-mobile-detection"
import VehicleCapture from "./vehicle-capture"
import MobileStats from "./mobile-stats"
import MobileCarList from "./mobile-car-list"
import CarImageViewer from "./car-image-viewer"
import ImageWithFallback from "../ui/image-with-fallback"

interface AvailableTicket {
  _id: string
  codigoTicket: string
  estado: string
}

interface Car {
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
  imagenes?: {
    plateImageUrl?: string
    vehicleImageUrl?: string
    fechaCaptura?: string
    capturaMetodo?: "manual" | "camara_movil" | "camara_desktop"
    confianzaPlaca?: number
    confianzaVehiculo?: number
  }
}

interface CarFormData {
  placa: string
  marca: string
  modelo: string
  color: string
  nombreDueño: string
  telefono: string
  ticketAsociado: string
  nota: string
}

interface CarRegistrationProps {
  onUpdate?: () => void
}

// Deep comparison for arrays
const areArraysEqual = <T extends { _id: string }>(arr1: T[], arr2: T[]) => {
  if (arr1.length !== arr2.length) return false
  return arr1.every((item1, i) => {
    const item2 = arr2[i]
    return Object.keys(item1).every((key) => item1[key as keyof T] === item2[key as keyof T])
  })
}

function CarRegistration({ onUpdate }: CarRegistrationProps) {
  const [cars, setCars] = useState<Car[]>([])
  const [availableTickets, setAvailableTickets] = useState<AvailableTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [showVehicleCapture, setShowVehicleCapture] = useState(false)
  const [selectedCarImages, setSelectedCarImages] = useState<Car | null>(null)
  const isMobile = useMobileDetection()
  const cameraRetryCount = useRef(0)
  const maxRetries = 10

  const [formData, setFormData] = useState<CarFormData>({
    placa: "",
    marca: "",
    modelo: "",
    color: "",
    nombreDueño: "",
    telefono: "",
    ticketAsociado: "",
    nota: "",
  })

  const [capturedImages, setCapturedImages] = useState<{
    placaUrl?: string
    vehiculoUrl?: string
    confianzaPlaca?: number
    confianzaVehiculo?: number
  } | null>(null)

  const fetchCars = useCallback(async () => {
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/admin/cars?t=${timestamp}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        next: { revalidate: 0 },
      })
      if (response.ok) {
        const data = await response.json()
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: FetchCars response:", data)
          data.forEach((car: Car, index: number) => {
            console.log(`🔍 DEBUG: Car ${index} - placa: ${car.placa}, horaIngreso: ${car.horaIngreso}`)
          })
        }
        setCars(data)
      } else {
        console.error("🔍 DEBUG: FetchCars response not ok:", response.status)
      }
    } catch (error) {
      console.error("Error fetching cars:", error)
    }
  }, [])

  const fetchAvailableTickets = useCallback(async () => {
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/admin/available-tickets?t=${timestamp}`, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        next: { revalidate: 0 },
      })
      if (response.ok) {
        const data = await response.json()
        setAvailableTickets((prev) => {
          if (!areArraysEqual(prev, data)) {
            if (process.env.NODE_ENV === "development") {
              console.log(`🔍 DEBUG: Actualizando tickets: ${data.length} disponibles`)
            }
            return data
          }
          return prev
        })
      }
    } catch (error) {
      console.error("Error fetching available tickets:", error)
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 DEBUG: Iniciando fetch de cars y tickets, isMobile: ${isMobile}`)
    }
    Promise.all([fetchCars(), fetchAvailableTickets()])
      .then(() => {
        setIsLoading(false)
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: Fetch completado, isLoading: false")
        }
      })
      .catch(() => {
        setIsLoading(false)
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: Fetch fallido, isLoading: false")
        }
      })
  }, [fetchCars, fetchAvailableTickets, isMobile])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCars()
      fetchAvailableTickets()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchCars, fetchAvailableTickets])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleTicketChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, ticketAsociado: value }))
  }, [])

  const handleVehicleDetected = useCallback(
    (vehicleData: {
      placa: string
      marca: string
      modelo: string
      color: string
      plateImageUrl: string
      vehicleImageUrl: string
      plateConfidence: number
      vehicleConfidence: number
    }) => {
      setFormData((prev) => ({
        ...prev,
        placa: vehicleData.placa,
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        color: vehicleData.color,
      }))
      setCapturedImages({
        placaUrl: vehicleData.plateImageUrl,
        vehiculoUrl: vehicleData.vehicleImageUrl,
        confianzaPlaca: vehicleData.plateConfidence,
        confianzaVehiculo: vehicleData.vehicleConfidence,
      })
      setShowVehicleCapture(false)
      setMessage(
        `✅ Vehículo capturado: ${vehicleData.marca} ${vehicleData.modelo} ${vehicleData.color} - Placa: ${vehicleData.placa}`,
      )
      setTimeout(() => setMessage(""), 5000)
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSubmitting(true)
      setMessage("")
      try {
        const submitData = {
          ...formData,
          imagenes: capturedImages
            ? {
                plateImageUrl: capturedImages.placaUrl,
                vehicleImageUrl: capturedImages.vehiculoUrl,
                capturaMetodo: isMobile ? "camara_movil" : "camara_desktop",
                confianzaPlaca: capturedImages.confianzaPlaca,
                confianzaVehiculo: capturedImages.confianzaVehiculo,
              }
            : undefined,
        }
        const response = await fetch("/api/admin/cars", {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          next: { revalidate: 0 },
          body: JSON.stringify(submitData),
        })
        const data = await response.json()
        if (response.ok) {
          setMessage(`✅ ${data.message}`)
          setFormData({
            placa: "",
            marca: "",
            modelo: "",
            color: "",
            nombreDueño: "",
            telefono: "",
            ticketAsociado: "",
            nota: "",
          })
          setCapturedImages(null)
          await Promise.all([fetchCars(), fetchAvailableTickets()])
          if (onUpdate) {
            onUpdate()
          }
        } else {
          setMessage(`❌ ${data.message}`)
        }
        setTimeout(() => setMessage(""), 5000)
      } catch (error) {
        setMessage("❌ Error al registrar el carro")
        setTimeout(() => setMessage(""), 5000)
      } finally {
        setIsSubmitting(false)
      }
    },
    [formData, capturedImages, isMobile, fetchCars, fetchAvailableTickets, onUpdate],
  )

  const isFormValid = useCallback(() => {
    if (isMobile) {
      return formData.placa.trim() !== "" && formData.ticketAsociado.trim() !== ""
    }
    return Object.values(formData).every((value) => value.trim() !== "")
  }, [formData, isMobile])

  const openCamera = useCallback(() => {
    if (cameraRetryCount.current < maxRetries) {
      setShowVehicleCapture(true)
      cameraRetryCount.current += 1
      if (process.env.NODE_ENV === "development") {
        console.log(`🔍 DEBUG: Attempting to open camera, attempt #${cameraRetryCount.current}`)
      }
    } else {
      setMessage("❌ Máximo de intentos de cámara alcanzado. Verifique permisos o hardware.")
      setTimeout(() => setMessage(""), 5000)
    }
  }, [])

  // Función para manejar la actualización después de editar un carro
  const handleCarUpdate = useCallback(() => {
    fetchCars()
    setSelectedCarImages(null)
    setMessage("✅ Información del vehículo actualizada correctamente")
    setTimeout(() => setMessage(""), 3000)
    if (onUpdate) {
      onUpdate()
    }
  }, [fetchCars, onUpdate])

  if (process.env.NODE_ENV === "development") {
    console.log(
      `🔍 DEBUG: Renderizando CarRegistration - isLoading: ${isLoading}, showVehicleCapture: ${showVehicleCapture}, selectedCarImages: ${!!selectedCarImages}, isMobile: ${isMobile}, cars: ${cars.length}, tickets: ${availableTickets.length}`,
    )
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              {isMobile ? <Smartphone className="h-5 w-5 mr-2" /> : <Monitor className="h-5 w-5 mr-2" />}
              Registro de Carros {isMobile ? "(Móvil)" : "(Desktop)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showVehicleCapture) {
    return <VehicleCapture onVehicleDetected={handleVehicleDetected} onCancel={() => setShowVehicleCapture(false)} />
  }

  if (selectedCarImages) {
    return (
      <CarImageViewer car={selectedCarImages} onClose={() => setSelectedCarImages(null)} onUpdate={handleCarUpdate} />
    )
  }

  if (isMobile) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        <div className="space-y-4 w-full">
          <MobileStats />
          <Card className="w-full border border-blue-200">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-center text-xl">
                <Camera className="h-6 w-6 mr-2 text-blue-600" />
                Registro Rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 w-full">
              {message && (
                <Alert variant={message.includes("❌") ? "destructive" : "default"} className="w-full">
                  <AlertDescription className="break-words">{message}</AlertDescription>
                </Alert>
              )}
              {availableTickets.length === 0 ? (
                <Alert variant="destructive" className="w-full">
                  <AlertDescription>No hay tickets disponibles para asignar.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4 w-full">
                  <Button onClick={openCamera} className="w-full py-8 text-lg bg-blue-600 hover:bg-blue-700" size="lg">
                    <Camera className="h-6 w-6 mr-3" />
                    Capturar Vehículo
                  </Button>
                  {capturedImages && (
                    <Alert className="w-full">
                      <AlertDescription>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <ImageIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="break-words">
                            ✅ Imágenes capturadas (Placa: {Math.round((capturedImages.confianzaPlaca || 0) * 100)}%,
                            Vehículo: {Math.round((capturedImages.confianzaVehiculo || 0) * 100)}%)
                          </span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4 w-full">
                    <div className="space-y-2 w-full">
                      <Label htmlFor="nota" className="text-lg">
                        Nota del Parquero
                      </Label>
                      <Textarea
                        id="nota"
                        name="nota"
                        value={formData.nota}
                        onChange={handleInputChange}
                        placeholder="Información adicional sobre el vehículo..."
                        className="text-lg py-3 resize-none w-full"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2 w-full">
                      <Label htmlFor="placa" className="text-lg">
                        Placa del Vehículo
                      </Label>
                      <Input
                        id="placa"
                        name="placa"
                        value={formData.placa}
                        onChange={handleInputChange}
                        placeholder="Ej. ABC123"
                        required
                        className="text-lg py-6 w-full"
                      />
                    </div>
                    <div className="space-y-2 w-full">
                      <Label htmlFor="ticketAsociado" className="text-lg">
                        Ticket de Estacionamiento
                      </Label>
                      <Select value={formData.ticketAsociado} onValueChange={handleTicketChange}>
                        <SelectTrigger className="text-lg py-6 w-full">
                          <SelectValue placeholder="Seleccione un ticket" />
                        </SelectTrigger>
                        <SelectContent className="max-w-full w-full">
                          {availableTickets.map((ticket) => (
                            <SelectItem
                              key={ticket._id}
                              value={ticket.codigoTicket}
                              className="text-lg max-w-full truncate"
                            >
                              {ticket.codigoTicket}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-500 text-center">
                        {availableTickets.length} espacios disponibles
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full py-6 text-lg"
                      disabled={!isFormValid() || isSubmitting}
                      variant={isFormValid() ? "default" : "secondary"}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      {isSubmitting ? "Registrando..." : "Registrar Vehículo"}
                    </Button>
                  </form>
                  <Alert className="w-full">
                    <AlertDescription className="text-center">
                      💡 <strong>Tip:</strong> Usa &quot;Capturar Vehículo&quot; para llenar datos automáticamente
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
          <MobileCarList cars={cars} onRefresh={fetchCars} onViewImages={setSelectedCarImages} />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-6 w-full">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Monitor className="h-5 w-5 mr-2" />
              Registro Completo (Desktop)
            </CardTitle>
          </CardHeader>
          <CardContent className="w-full">
            {message && (
              <Alert variant={message.includes("❌") ? "destructive" : "default"} className="mb-4 w-full">
                <AlertDescription className="break-words">{message}</AlertDescription>
              </Alert>
            )}
            {availableTickets.length === 0 ? (
              <Alert variant="destructive" className="w-full">
                <AlertDescription>
                  No hay tickets disponibles. Crea tickets primero en la pestaña &quot;Gestión de Tickets&quot;.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="space-y-2 md:col-span-2 w-full">
                    <Label htmlFor="nota">Nota del Parquero</Label>
                    <Textarea
                      id="nota"
                      name="nota"
                      value={formData.nota}
                      onChange={handleInputChange}
                      placeholder="Información adicional sobre el vehículo..."
                      className="resize-none w-full"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="placa">Placa del Vehículo</Label>
                    <Input
                      id="placa"
                      name="placa"
                      value={formData.placa}
                      onChange={handleInputChange}
                      placeholder="Ej. ABC123"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="ticketAsociado">Ticket de Estacionamiento</Label>
                    <Select value={formData.ticketAsociado} onValueChange={handleTicketChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccione un ticket disponible" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTickets.map((ticket) => (
                          <SelectItem key={ticket._id} value={ticket.codigoTicket}>
                            {ticket.codigoTicket}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500">Tickets disponibles: {availableTickets.length}</p>
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      name="marca"
                      value={formData.marca}
                      onChange={handleInputChange}
                      placeholder="Ej. Toyota"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input
                      id="modelo"
                      name="modelo"
                      value={formData.modelo}
                      onChange={handleInputChange}
                      placeholder="Ej. Corolla"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      name="color"
                      value={formData.color}
                      onChange={handleInputChange}
                      placeholder="Ej. Blanco"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="nombreDueño">Nombre del Dueño</Label>
                    <Input
                      id="nombreDueño"
                      name="nombreDueño"
                      value={formData.nombreDueño}
                      onChange={handleInputChange}
                      placeholder="Ej. Juan Pérez"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      placeholder="Ej. 0414-1234567"
                      required
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="space-y-2 w-full">
                  <Button type="submit" className="w-full" disabled={!isFormValid() || isSubmitting}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Registrando..." : "Registrar Carro"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Lista de Carros Estacionados - Desktop */}
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Carros Estacionados Actualmente</CardTitle>
            <Button onClick={fetchCars} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </CardHeader>
          <CardContent className="w-full">
            <div className="space-y-3 max-h-96 overflow-y-auto overflow-x-hidden w-full">
              {cars?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay carros estacionados actualmente.</p>
                </div>
              ) : (
                cars
                  .filter((car) => car.estado === "estacionado" || car.estado === "estacionado_confirmado")
                  .map((car) => (
                    <div
                      key={car._id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors w-full min-w-0"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <p className="font-medium text-lg break-words">{car.placa}</p>
                            <Badge variant={car.estado === "estacionado_confirmado" ? "default" : "secondary"}>
                              {car.estado === "estacionado_confirmado" ? "Confirmado" : "Pendiente"}
                            </Badge>
                          </div>
                          {car.nota && (
                            <div className="p-2 bg-blue-50 rounded text-sm">
                              <span className="text-blue-600 font-medium break-words">📝 {car.nota}</span>
                            </div>
                          )}
                          <p className="text-sm text-gray-600 break-words">
                            {car.marca} {car.modelo} - {car.color}
                          </p>
                          <p className="text-sm text-gray-600 break-words">
                            Dueño: {car.nombreDueño} | Tel: {car.telefono}
                          </p>
                          <p className="font-medium break-words">Ticket: {car.ticketAsociado}</p>
                          <p className="text-sm text-gray-500">
                            Ingreso: {car.horaIngreso ? formatDateTime(car.horaIngreso) : "Sin fecha"}
                          </p>
                        </div>
                      </div>

                      {/* Vista previa de imágenes en desktop */}
                      {(car.imagenes?.plateImageUrl || car.imagenes?.vehicleImageUrl) && (
                        <div className="flex space-x-2 flex-shrink-0 ml-4">
                          {car.imagenes?.plateImageUrl && (
                            <div className="text-center">
                              <ImageWithFallback
                                src={car.imagenes.plateImageUrl || "/placeholder.svg"}
                                alt={`Placa de ${car.placa}`}
                                className="w-20 h-14 object-cover rounded border"
                                fallback="/placeholder.svg"
                              />
                              <p className="text-xs text-gray-500 mt-1">Placa</p>
                            </div>
                          )}
                          {car.imagenes?.vehicleImageUrl && (
                            <div className="text-center">
                              <ImageWithFallback
                                src={car.imagenes.vehicleImageUrl || "/placeholder.svg"}
                                alt={`Vehículo de ${car.placa}`}
                                className="w-20 h-14 object-cover rounded border"
                                fallback="/placeholder.svg"
                              />
                              <p className="text-xs text-gray-500 mt-1">Vehículo</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col space-y-2 ml-4 flex-shrink-0">
                        <Button
                          onClick={() => setSelectedCarImages(car)}
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs whitespace-nowrap"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        {car.imagenes && (
                          <Button
                            onClick={() => setSelectedCarImages(car)}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs whitespace-nowrap"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver Imágenes
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default memo(CarRegistration)
