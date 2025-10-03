"use client"

import React, { useState, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatDateTime } from "@/lib/utils"
import { Car, Clock, RefreshCw, Check, X, Edit3, Camera, ImageIcon, CheckCircle, AlertCircle, Zap } from "lucide-react"
import ImageWithFallback from "../ui/image-with-fallback"
import QuickExitModal from "./quick-exit-modal"

interface CarInfo {
  _id: string
  placa: string
  marca: string
  modelo: string
  color: string
  estado: string
  fechaIngreso: string
  ticketAsociado: string
  nombreDueño?: string
  telefono?: string
  horaIngreso?: string
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

interface MobileCarListProps {
  cars: CarInfo[]
  onRefresh: () => void
  onViewImages?: (car: CarInfo) => void
}

const MobileCarList: React.FC<MobileCarListProps> = ({ cars, onRefresh, onViewImages }) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<CarInfo>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [capturedImages, setCapturedImages] = useState<{
    plate?: string
    vehicle?: string
  }>({})
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "">("")

  const plateFileInputRef = useRef<HTMLInputElement>(null)
  const vehicleFileInputRef = useRef<HTMLInputElement>(null)

  const [quickExitModal, setQuickExitModal] = useState<{
    isOpen: boolean
    car: CarInfo | null
    isProcessing: boolean
  }>({
    isOpen: false,
    car: null,
    isProcessing: false,
  })

  const showMessage = useCallback((msg: string, type: "success" | "error") => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => {
      setMessage("")
      setMessageType("")
    }, 3000)
  }, [])

  const handleEditClick = useCallback((car: CarInfo) => {
    setEditingId(car._id)
    setEditForm({
      placa: car.placa,
      marca: car.marca,
      modelo: car.modelo,
      color: car.color,
      nombreDueño: car.nombreDueño || "",
      telefono: car.telefono || "",
      nota: car.nota || "",
    })
    setCapturedImages({})
    setMessage("")
    setMessageType("")
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm({})
    setCapturedImages({})
    setMessage("")
    setMessageType("")
  }, [])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: "plate" | "vehicle") => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCapturedImages((prev) => ({ ...prev, [type]: e.target?.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const uploadToCloudinary = useCallback(async (imageUrl: string, type: "plate" | "vehicle") => {
    setIsUploadingImage(true)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const formData = new FormData()
      formData.append("image", blob)
      formData.append("type", type)
      formData.append("method", "camara_movil")

      const uploadResponse = await fetch("/api/admin/process-vehicle", {
        method: "POST",
        body: formData,
      })

      const result = await uploadResponse.json()
      if (result.success) {
        return result.imageUrl
      } else {
        throw new Error(result.message || "Error subiendo imagen")
      }
    } catch (err) {
      console.error(`Error subiendo ${type}:`, err)
      return null
    } finally {
      setIsUploadingImage(false)
    }
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || isSaving || isUploadingImage) return

    setIsSaving(true)
    setMessage("")
    setMessageType("")

    try {
      const updateData: any = { ...editForm }

      if (capturedImages.plate) {
        const plateUrl = await uploadToCloudinary(capturedImages.plate, "plate")
        if (plateUrl) {
          updateData.plateImageUrl = plateUrl
        }
      }

      if (capturedImages.vehicle) {
        const vehicleUrl = await uploadToCloudinary(capturedImages.vehicle, "vehicle")
        if (vehicleUrl) {
          updateData.vehicleImageUrl = vehicleUrl
        }
      }

      const response = await fetch(`/api/admin/cars/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        onRefresh()
        setEditingId(null)
        setEditForm({})
        setCapturedImages({})
        showMessage("✅ Vehículo actualizado correctamente", "success")
      } else {
        const errorData = await response.json()
        showMessage(`❌ Error: ${errorData.message || "Error al actualizar"}`, "error")
      }
    } catch (error) {
      console.error("Error updating car:", error)
      showMessage("❌ Error de conexión", "error")
    } finally {
      setIsSaving(false)
    }
  }, [editingId, editForm, capturedImages, onRefresh, isSaving, isUploadingImage, uploadToCloudinary, showMessage])

  const handleQuickExit = useCallback((car: CarInfo) => {
    setQuickExitModal({
      isOpen: true,
      car,
      isProcessing: false,
    })
  }, [])

  const handleQuickExitConfirm = useCallback(
    async (exitNote: string) => {
      if (!quickExitModal.car) return

      setQuickExitModal((prev) => ({ ...prev, isProcessing: true }))

      try {
        const response = await fetch(`/api/admin/cars/${quickExitModal.car._id}/quick-exit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ exitNote }),
        })

        if (response.ok) {
          const data = await response.json()
          showMessage(`✅ ${data.message}`, "success")
          onRefresh()
          setQuickExitModal({ isOpen: false, car: null, isProcessing: false })
        } else {
          const errorData = await response.json()
          showMessage(`❌ Error: ${errorData.message}`, "error")
        }
      } catch (error) {
        console.error("Error processing quick exit:", error)
        showMessage("❌ Error de conexión", "error")
      } finally {
        setQuickExitModal((prev) => ({ ...prev, isProcessing: false }))
      }
    },
    [quickExitModal.car, onRefresh, showMessage],
  )

  const handleQuickExitClose = useCallback(() => {
    if (!quickExitModal.isProcessing) {
      setQuickExitModal({ isOpen: false, car: null, isProcessing: false })
    }
  }, [quickExitModal.isProcessing])

  const handleInputChange = useCallback((field: keyof CarInfo, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "estacionado":
        return <Badge variant="secondary">Pendiente Confirmación</Badge>
      case "estacionado_confirmado":
        return <Badge variant="default">Confirmado</Badge>
      case "pago_pendiente_validacion":
        return <Badge variant="destructive">Pago Pendiente</Badge>
      case "pagado_validado":
        return <Badge variant="outline">Pagado - Listo para Salir</Badge>
      default:
        return <Badge variant="secondary">{estado}</Badge>
    }
  }

  const isFormDisabled = isSaving || isUploadingImage

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-3 w-full">
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-semibold">Carros Estacionados</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFormDisabled}
            className="flex-shrink-0 bg-transparent"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {message && (
          <Alert variant={messageType === "error" ? "destructive" : "default"} className="w-full">
            <div className="flex items-center">
              {messageType === "success" ? (
                <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              )}
              <AlertDescription className="break-words">{message}</AlertDescription>
            </div>
          </Alert>
        )}

        {cars.length === 0 ? (
          <Card className="w-full">
            <CardContent className="p-6 text-center">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No hay carros estacionados</p>
            </CardContent>
          </Card>
        ) : (
          cars.map((car) => (
            <Card key={car._id} className={`w-full ${editingId === car._id ? "ring-2 ring-blue-500" : ""}`}>
              <CardContent className="p-4 w-full overflow-hidden">
                {editingId === car._id ? (
                  <div className="space-y-3 w-full overflow-hidden">
                    <div className="flex items-center justify-between mb-2 w-full">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Car className="h-4 w-4 flex-shrink-0" />
                        <Input
                          value={editForm.placa || ""}
                          onChange={(e) => handleInputChange("placa", e.target.value)}
                          className="h-8 w-24 text-sm font-semibold flex-shrink-0"
                          placeholder="Placa"
                          disabled={isFormDisabled}
                        />
                      </div>
                      <div className="flex-shrink-0">{getStatusBadge(car.estado)}</div>
                    </div>

                    <div className="w-full">
                      <Label className="text-xs text-muted-foreground">Nota del Parquero</Label>
                      <Input
                        value={editForm.nota || ""}
                        onChange={(e) => handleInputChange("nota", e.target.value)}
                        className="h-8 text-sm w-full"
                        placeholder="Información adicional..."
                        disabled={isFormDisabled}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Input
                        value={editForm.marca || ""}
                        onChange={(e) => handleInputChange("marca", e.target.value)}
                        className="h-8 text-sm w-full"
                        placeholder="Marca"
                        disabled={isFormDisabled}
                      />
                      <Input
                        value={editForm.modelo || ""}
                        onChange={(e) => handleInputChange("modelo", e.target.value)}
                        className="h-8 text-sm w-full"
                        placeholder="Modelo"
                        disabled={isFormDisabled}
                      />
                    </div>

                    <Input
                      value={editForm.color || ""}
                      onChange={(e) => handleInputChange("color", e.target.value)}
                      className="h-8 text-sm w-full"
                      placeholder="Color"
                      disabled={isFormDisabled}
                    />

                    <Input
                      value={editForm.nombreDueño || ""}
                      onChange={(e) => handleInputChange("nombreDueño", e.target.value)}
                      className="h-8 text-sm w-full"
                      placeholder="Nombre del dueño"
                      disabled={isFormDisabled}
                    />

                    <Input
                      value={editForm.telefono || ""}
                      onChange={(e) => handleInputChange("telefono", e.target.value)}
                      className="h-8 text-sm w-full"
                      placeholder="Teléfono"
                      disabled={isFormDisabled}
                    />

                    <div className="space-y-3 pt-2 border-t w-full overflow-hidden">
                      <Label className="text-sm font-medium">Imágenes</Label>

                      {(car.imagenes?.plateImageUrl || car.imagenes?.vehicleImageUrl) && (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          {car.imagenes?.plateImageUrl && (
                            <div className="min-w-0">
                              <Label className="text-xs text-muted-foreground">Placa Actual</Label>
                              <ImageWithFallback
                                src={car.imagenes.plateImageUrl || "/placeholder.svg"}
                                alt="Placa actual"
                                className="w-full h-20 object-cover rounded border max-w-full"
                                fallback="/placeholder.svg"
                              />
                            </div>
                          )}
                          {car.imagenes?.vehicleImageUrl && (
                            <div className="min-w-0">
                              <Label className="text-xs text-muted-foreground">Vehículo Actual</Label>
                              <ImageWithFallback
                                src={car.imagenes.vehicleImageUrl || "/placeholder.svg"}
                                alt="Vehículo actual"
                                className="w-full h-20 object-cover rounded border max-w-full"
                                fallback="/placeholder.svg"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {(capturedImages.plate || capturedImages.vehicle) && (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          {capturedImages.plate && (
                            <div className="min-w-0">
                              <Label className="text-xs text-green-600">Nueva Placa</Label>
                              <ImageWithFallback
                                src={capturedImages.plate || "/placeholder.svg"}
                                alt="Nueva placa"
                                className="w-full h-20 object-cover rounded border border-green-500 max-w-full"
                                fallback="/placeholder.svg"
                              />
                            </div>
                          )}
                          {capturedImages.vehicle && (
                            <div className="min-w-0">
                              <Label className="text-xs text-green-600">Nuevo Vehículo</Label>
                              <ImageWithFallback
                                src={capturedImages.vehicle || "/placeholder.svg"}
                                alt="Nuevo vehículo"
                                className="w-full h-20 object-cover rounded border border-green-500 max-w-full"
                                fallback="/placeholder.svg"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 w-full">
                        <div className="min-w-0">
                          <input
                            ref={plateFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, "plate")}
                            className="hidden"
                            disabled={isFormDisabled}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => plateFileInputRef.current?.click()}
                            className="w-full h-8 text-xs"
                            disabled={isFormDisabled}
                          >
                            <Camera className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">{capturedImages.plate ? "Cambiar Placa" : "Foto Placa"}</span>
                          </Button>
                        </div>
                        <div className="min-w-0">
                          <input
                            ref={vehicleFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, "vehicle")}
                            className="hidden"
                            disabled={isFormDisabled}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => vehicleFileInputRef.current?.click()}
                            className="w-full h-8 text-xs"
                            disabled={isFormDisabled}
                          >
                            <ImageIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">
                              {capturedImages.vehicle ? "Cambiar Vehículo" : "Foto Vehículo"}
                            </span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1 w-full">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="break-words">
                          Ingreso: {car.horaIngreso ? formatDateTime(car.horaIngreso) : "Sin fecha"}
                        </span>
                      </div>
                      <p className="break-words">Ticket: {car.ticketAsociado}</p>
                    </div>

                    <div className="flex gap-2 pt-2 w-full">
                      <Button size="sm" onClick={handleSaveEdit} disabled={isFormDisabled} className="flex-1">
                        <Check className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {isSaving ? "Guardando..." : isUploadingImage ? "Subiendo..." : "Guardar"}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isFormDisabled}
                        className="flex-1 bg-transparent"
                      >
                        <X className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">Cancelar</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full overflow-hidden">
                    <div onClick={() => handleEditClick(car)} className="cursor-pointer w-full">
                      <div className="flex items-center justify-between mb-2 w-full">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Car className="h-4 w-4 flex-shrink-0" />
                          <span className="font-semibold break-words">{car.placa}</span>
                          <Edit3 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </div>
                        <div className="flex-shrink-0">{getStatusBadge(car.estado)}</div>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1 w-full">
                        {car.nota && (
                          <div className="mb-2 p-2 bg-pink-50 rounded text-sm w-full">
                            <span className="text-pink-600 font-medium break-words">📝 {car.nota}</span>
                          </div>
                        )}
                        <p className="break-words">
                          {car.marca} {car.modelo} - {car.color}
                        </p>
                        {car.nombreDueño && <p className="break-words">Dueño: {car.nombreDueño}</p>}
                        {car.telefono && <p className="break-words">Teléfono: {car.telefono}</p>}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="break-words">
                            Ingreso: {car.horaIngreso ? formatDateTime(car.horaIngreso) : "Sin fecha"}
                          </span>
                        </div>
                        <p className="break-words">Ticket: {car.ticketAsociado}</p>

                        {(car.imagenes?.plateImageUrl || car.imagenes?.vehicleImageUrl) && (
                          <div className="flex gap-2 mt-2 pt-2 border-t w-full overflow-hidden">
                            {car.imagenes?.plateImageUrl && (
                              <div className="flex-1 min-w-0">
                                <ImageWithFallback
                                  src={car.imagenes.plateImageUrl || "/placeholder.svg"}
                                  alt="Placa"
                                  className="w-full h-16 object-cover rounded border max-w-full"
                                  fallback="/placeholder.svg"
                                />
                                <p className="text-xs text-center mt-1 text-gray-500">Placa</p>
                              </div>
                            )}
                            {car.imagenes?.vehicleImageUrl && (
                              <div className="flex-1 min-w-0">
                                <ImageWithFallback
                                  src={car.imagenes.vehicleImageUrl || "/placeholder.svg"}
                                  alt="Vehículo"
                                  className="w-full h-16 object-cover rounded border max-w-full"
                                  fallback="/placeholder.svg"
                                />
                                <p className="text-xs text-center mt-1 text-gray-500">Vehículo</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t w-full">
                      <Button
                        onClick={() => handleEditClick(car)}
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        <Edit3 className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">Editar</span>
                      </Button>
                      <Button
                        onClick={() => handleQuickExit(car)}
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                      >
                        <Zap className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">Salida Rápida</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {quickExitModal.car && (
        <QuickExitModal
          car={quickExitModal.car}
          isOpen={quickExitModal.isOpen}
          onClose={handleQuickExitClose}
          onConfirm={handleQuickExitConfirm}
          isProcessing={quickExitModal.isProcessing}
        />
      )}
    </div>
  )
}

MobileCarList.displayName = "MobileCarList"

export default React.memo(MobileCarList)