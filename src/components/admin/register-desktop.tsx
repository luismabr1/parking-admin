import React, { memo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CarIcon, RefreshCw, Plus, Monitor, Edit, Eye, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import ImageWithFallback from "../ui/image-with-fallback";
import QuickExitModal from "./quick-exit-modal";

interface AvailableTicket {
  _id: string;
  codigoTicket: string;
  estado: string;
}

interface Car {
  _id: string;
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  nombreDueño: string;
  telefono: string;
  ticketAsociado: string;
  horaIngreso: string;
  estado: string;
  nota?: string;
  imagenes?: {
    plateImageUrl?: string;
    vehicleImageUrl?: string;
    fechaCaptura?: string;
    capturaMetodo?: "manual" | "camara_movil" | "camara_desktop";
    confianzaPlaca?: number;
    confianzaVehiculo?: number;
  };
}

interface CarFormData {
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  nombreDueño: string;
  telefono: string;
  ticketAsociado: string;
  nota: string;
}

interface CarRegistrationProps {
  onUpdate?: () => void;
}

const areArraysEqual = <T extends { _id: string }>(arr1: T[], arr2: T[]) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item1, i) => {
    const item2 = arr2[i];
    return Object.keys(item1).every((key) => item1[key as keyof T] === item2[key as keyof T]);
  });
};

function RegisterDesktop({ onUpdate }: CarRegistrationProps) {
  const [cars, setCars] = useState<Car[]>([]);
  const [availableTickets, setAvailableTickets] = useState<AvailableTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedCarImages, setSelectedCarImages] = useState<Car | null>(null);
  const [quickExitModal, setQuickExitModal] = useState<{
    isOpen: boolean;
    car: Car | null;
    isProcessing: boolean;
  }>({
    isOpen: false,
    car: null,
    isProcessing: false,
  });

  const [formData, setFormData] = useState<CarFormData>({
    placa: "",
    marca: "",
    modelo: "",
    color: "",
    nombreDueño: "",
    telefono: "",
    ticketAsociado: "",
    nota: "",
  });

  const fetchCars = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/admin/cars?t=${timestamp}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        next: { revalidate: 0 },
      });
      if (response.ok) {
        const data = await response.json();
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: FetchCars response:", data);
          data.forEach((car: Car, index: number) => {
            console.log(`🔍 DEBUG: Car ${index} - placa: ${car.placa}, horaIngreso: ${car.horaIngreso}`);
          });
        }
        setCars(data);
      } else {
        console.error("🔍 DEBUG: FetchCars response not ok:", response.status);
        setMessage("❌ Error al obtener los vehículos");
      }
    } catch (error) {
      console.error("Error fetching cars:", error);
      setMessage("❌ Error al conectar con el servidor para obtener vehículos");
    }
  }, []);

  const fetchAvailableTickets = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/admin/available-tickets?t=${timestamp}`, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        next: { revalidate: 0 },
      });
      if (response.ok) {
        const data = await response.json();
        if (process.env.NODE_ENV === "development") {
          console.log(`🔍 DEBUG: FetchAvailableTickets response: ${JSON.stringify(data)}`);
        }
        setAvailableTickets((prev) => {
          if (!areArraysEqual(prev, data)) {
            if (process.env.NODE_ENV === "development") {
              console.log(`🔍 DEBUG: Actualizando tickets: ${data.length} disponibles`);
            }
            return data;
          }
          return prev;
        });
      } else {
        console.error("🔍 DEBUG: FetchAvailableTickets response not ok:", response.status);
        setMessage("❌ Error al obtener los tickets disponibles");
      }
    } catch (error) {
      console.error("Error fetching available tickets:", error);
      setMessage("❌ Error al conectar con el servidor para obtener tickets");
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 DEBUG: Iniciando fetch de cars y tickets`);
    }
    setIsLoading(true);
    Promise.all([fetchCars(), fetchAvailableTickets()])
      .then(() => {
        setIsLoading(false);
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: Fetch completado, isLoading: false");
        }
      })
      .catch(() => {
        setIsLoading(false);
        setMessage("❌ Error al cargar datos iniciales");
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 DEBUG: Fetch fallido, isLoading: false");
        }
      });
  }, [fetchCars, fetchAvailableTickets]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCars();
      fetchAvailableTickets();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchCars, fetchAvailableTickets]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleTicketChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, ticketAsociado: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setMessage("");
      try {
        const response = await fetch("/api/admin/cars", {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          next: { revalidate: 0 },
          body: JSON.stringify(formData),
        });
        const data = await response.json();
        if (response.ok) {
          setMessage(`✅ ${data.message}`);
          setFormData({
            placa: "",
            marca: "",
            modelo: "",
            color: "",
            nombreDueño: "",
            telefono: "",
            ticketAsociado: "",
            nota: "",
          });
          await Promise.all([fetchCars(), fetchAvailableTickets()]);
          if (onUpdate) {
            onUpdate();
          }
        } else {
          setMessage(`❌ ${data.message}`);
        }
        setTimeout(() => setMessage(""), 5000);
      } catch (error) {
        setMessage("❌ Error al registrar el carro");
        setTimeout(() => setMessage(""), 5000);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, fetchCars, fetchAvailableTickets, onUpdate],
  );

  const isFormValid = useCallback(() => {
    return Object.values(formData).every((value) => value.trim() !== "");
  }, [formData]);

  const handleCarUpdate = useCallback(() => {
    fetchCars();
    setSelectedCarImages(null);
    setMessage("✅ Información del vehículo actualizada correctamente");
    setTimeout(() => setMessage(""), 3000);
    if (onUpdate) {
      onUpdate();
    }
  }, [fetchCars, onUpdate]);

  const handleQuickExit = useCallback((car: Car) => {
    setQuickExitModal({
      isOpen: true,
      car,
      isProcessing: false,
    });
  }, []);

  const handleQuickExitConfirm = useCallback(
    async (exitNote: string) => {
      if (!quickExitModal.car) return;

      setQuickExitModal((prev) => ({ ...prev, isProcessing: true }));

      try {
        const response = await fetch(`/api/admin/cars/${quickExitModal.car._id}/quick-exit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ exitNote }),
        });

        if (response.ok) {
          const data = await response.json();
          setMessage(`✅ ${data.message}`);
          setTimeout(() => setMessage(""), 5000);
          await fetchCars();
          if (onUpdate) onUpdate();
          setQuickExitModal({ isOpen: false, car: null, isProcessing: false });
        } else {
          const errorData = await response.json();
          setMessage(`❌ Error: ${errorData.message}`);
          setTimeout(() => setMessage(""), 5000);
        }
      } catch (error) {
        console.error("Error processing quick exit:", error);
        setMessage("❌ Error de conexión");
        setTimeout(() => setMessage(""), 5000);
      } finally {
        setQuickExitModal((prev) => ({ ...prev, isProcessing: false }));
      }
    },
    [quickExitModal.car, fetchCars, onUpdate],
  );

  const handleQuickExitClose = useCallback(() => {
    if (!quickExitModal.isProcessing) {
      setQuickExitModal({ isOpen: false, car: null, isProcessing: false });
    }
  }, [quickExitModal.isProcessing]);

  if (isLoading) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Monitor className="h-5 w-5 mr-2" />
              Registro de Carros (Desktop)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedCarImages) {
    return (
      <div>CarImageViewer component placeholder</div> // Replace with actual CarImageViewer component
    );
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
                        <Button
                          onClick={() => handleQuickExit(car)}
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs whitespace-nowrap bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Salida Rápida
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
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
  );
}

export default memo(RegisterDesktop);