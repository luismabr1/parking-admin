"use client"
import type React from "react"
import { memo, useState, useEffect, useCallback, useRef } from "react"
import MobileStats from "./mobile-stats"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, ImageIcon, Plus, Smartphone, Ticket } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMobileDetection } from "@/hooks/use-mobile-detection"
import MobileCarList from "./mobile-car-list"
import VehicleCapture from "./vehicle-capture"
import CarImageViewer from "./car-image-viewer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

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

function RegisterMobile({ onUpdate }: CarRegistrationProps) {
  const [message, setMessage] = useState("")
  const [cars, setCars] = useState<Car[]>([])
  const [availableTickets, setAvailableTickets] = useState<AvailableTicket[]>([])
  const [showVehicleCapture, setShowVehicleCapture] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isMobile = useMobileDetection()
  const [selectedCarImages, setSelectedCarImages] = useState<Car | null>(null)
  const [capturedImages, setCapturedImages] = useState<{
    placaUrl?: string
    vehiculoUrl?: string
    confianzaPlaca?: number
    confianzaVehiculo?: number
  } | null>(null)
  const cameraRetryCount = useRef(0)
  const maxRetries = 10
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)

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
        setMessage("❌ Error al obtener los vehículos")
      }
    } catch (error) {
      console.error("Error fetching cars:", error)
      setMessage("❌ Error al conectar con el servidor para obtener vehículos")
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
        if (process.env.NODE_ENV === "development") {
          console.log(`🔍 DEBUG: FetchAvailableTickets response: ${JSON.stringify(data)}`)
        }
        setAvailableTickets((prev) => {
          if (!areArraysEqual(prev, data)) {
            if (process.env.NODE_ENV === "development") {
              console.log(`🔍 DEBUG: Actualizando tickets: ${data.length} disponibles`)
            }
            return data
          }
          return prev
        })
      } else {
        console.error("🔍 DEBUG: FetchAvailableTickets response not ok:", response.status)
        setMessage("❌ Error al obtener los tickets disponibles")
      }
    } catch (error) {
      console.error("Error fetching available tickets:", error)
      setMessage("❌ Error al conectar con el servidor para obtener tickets")
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 DEBUG: Iniciando fetch de cars y tickets, isMobile: ${isMobile}`)
    }
    setIsLoading(true)
    Promise.all([fetchCars(), fetchAvailableTickets()])
      .then(() => {
        setIsLoading(false)
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: Fetch completado, isLoading: false")
        }
      })
      .catch(() => {
        setIsLoading(false)
        setMessage("❌ Error al cargar datos iniciales")
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

  const isFormValid = useCallback(() => {
    return formData.placa.trim() !== "" && formData.ticketAsociado.trim() !== ""
  }, [formData])

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

  const handleTicketChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, ticketAsociado: value }))
    setIsTicketDialogOpen(false)
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

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            Registro de Carros (Móvil)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showVehicleCapture) {
    return <VehicleCapture onVehicleDetected={handleVehicleDetected} onCancel={() => setShowVehicleCapture(false)} />
  }

  if (selectedCarImages) {
    return <CarImageViewer car={selectedCarImages} onClose={() => setSelectedCarImages(null)} onUpdate={fetchCars} />
  }

  if (process.env.NODE_ENV === "development") {
    console.log("🔍 DEBUG: availableTickets before render:", availableTickets)
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="space-y-4 w-full max-w-full">
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
                      className="text-lg h-12 w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="ticketAsociado" className="text-lg">
                      Ticket de Estacionamiento
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsTicketDialogOpen(true)}
                      className="w-full h-12 text-lg justify-start"
                    >
                      <Ticket className="h-5 w-5 mr-2" />
                      {formData.ticketAsociado || "Seleccione un ticket"}
                    </Button>
                    <p className="text-sm text-gray-500 text-center">{availableTickets.length} espacios disponibles</p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 text-lg"
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
      <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
        <DialogContent className="max-w-[85vw] sm:max-w-md max-h-[50vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">Seleccionar Ticket</DialogTitle>
            <DialogDescription className="text-sm">
              Seleccione un ticket disponible para asignar al vehículo
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[35vh] overflow-y-auto overflow-x-hidden space-y-2 py-2">
            {availableTickets.map((ticket) => (
              <Button
                key={ticket._id}
                variant={formData.ticketAsociado === ticket.codigoTicket ? "default" : "outline"}
                className="w-full h-12 text-base justify-start"
                onClick={() => handleTicketChange(ticket.codigoTicket)}
              >
                <Ticket className="h-4 w-4 mr-3" />
                {ticket.codigoTicket}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default memo(RegisterMobile)
