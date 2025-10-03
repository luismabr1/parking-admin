"use client";

import type React from "react";
import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Smartphone, Monitor } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMobileDetection } from "@/hooks/use-mobile-detection";
import VehicleCapture from "./vehicle-capture";
import CarImageViewer from "./car-image-viewer";
import QuickExitModal from "./quick-exit-modal";
import ImageWithFallback from "../ui/image-with-fallback";
import RegisterMobile from "./register-mobile";
import RegisterDesktop from "./register-desktop"; // Assuming this component exists

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

// Deep comparison for arrays
const areArraysEqual = <T extends { _id: string }>(arr1: T[], arr2: T[]) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item1, i) => {
    const item2 = arr2[i];
    return Object.keys(item1).every((key) => item1[key as keyof T] === item2[key as keyof T]);
  });
};

function CarRegistration({ onUpdate }: CarRegistrationProps) {
  const [cars, setCars] = useState<Car[]>([]);
  const [availableTickets, setAvailableTickets] = useState<AvailableTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [showVehicleCapture, setShowVehicleCapture] = useState(false);
  const [selectedCarImages, setSelectedCarImages] = useState<Car | null>(null);
  const isMobile = useMobileDetection();
  const cameraRetryCount = useRef(0);
  const maxRetries = 10;

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

  const [capturedImages, setCapturedImages] = useState<{
    placaUrl?: string;
    vehiculoUrl?: string;
    confianzaPlaca?: number;
    confianzaVehiculo?: number;
  } | null>(null);

  const [quickExitModal, setQuickExitModal] = useState<{
    isOpen: boolean;
    car: Car | null;
    isProcessing: boolean;
  }>({
    isOpen: false,
    car: null,
    isProcessing: false,
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
      console.log(`🔍 DEBUG: Iniciando fetch de cars y tickets, isMobile: ${isMobile}`);
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
  }, [fetchCars, fetchAvailableTickets, isMobile]);

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

  const handleVehicleDetected = useCallback(
    (vehicleData: {
      placa: string;
      marca: string;
      modelo: string;
      color: string;
      plateImageUrl: string;
      vehicleImageUrl: string;
      plateConfidence: number;
      vehicleConfidence: number;
    }) => {
      setFormData((prev) => ({
        ...prev,
        placa: vehicleData.placa,
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        color: vehicleData.color,
      }));
      setCapturedImages({
        placaUrl: vehicleData.plateImageUrl,
        vehiculoUrl: vehicleData.vehicleImageUrl,
        confianzaPlaca: vehicleData.plateConfidence,
        confianzaVehiculo: vehicleData.vehicleConfidence,
      });
      setShowVehicleCapture(false);
      setMessage(
        `✅ Vehículo capturado: ${vehicleData.marca} ${vehicleData.modelo} ${vehicleData.color} - Placa: ${vehicleData.placa}`,
      );
      setTimeout(() => setMessage(""), 5000);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setMessage("");
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
        };
        const response = await fetch("/api/admin/cars", {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          next: { revalidate: 0 },
          body: JSON.stringify(submitData),
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
          setCapturedImages(null);
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
    [formData, capturedImages, isMobile, fetchCars, fetchAvailableTickets, onUpdate],
  );

  const isFormValid = useCallback(() => {
    if (isMobile) {
      return formData.placa.trim() !== "" && formData.ticketAsociado.trim() !== "";
    }
    return Object.values(formData).every((value) => value.trim() !== "");
  }, [formData, isMobile]);

  const openCamera = useCallback(() => {
    if (cameraRetryCount.current < maxRetries) {
      setShowVehicleCapture(true);
      cameraRetryCount.current += 1;
      if (process.env.NODE_ENV === "development") {
        console.log(`🔍 DEBUG: Attempting to open camera, attempt #${cameraRetryCount.current}`);
      }
    } else {
      setMessage("❌ Máximo de intentos de cámara alcanzado. Verifique permisos o hardware.");
      setTimeout(() => setMessage(""), 5000);
    }
  }, []);

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

  if (process.env.NODE_ENV === "development") {
    console.log(
      `🔍 DEBUG: Renderizando CarRegistration - isLoading: ${isLoading}, showVehicleCapture: ${showVehicleCapture}, selectedCarImages: ${!!selectedCarImages}, isMobile: ${isMobile}, cars: ${cars.length}, tickets: ${availableTickets.length}`,
    );
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {isMobile ? <Smartphone className="h-5 w-5 mr-2" /> : <Monitor className="h-5 w-5 mr-2" />}
              Registro de Carros {isMobile ? "(Móvil)" : "(Desktop)"}
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

  if (showVehicleCapture) {
    return <VehicleCapture onVehicleDetected={handleVehicleDetected} onCancel={() => setShowVehicleCapture(false)} />;
  }

  if (selectedCarImages) {
    return (
      <CarImageViewer car={selectedCarImages} onClose={() => setSelectedCarImages(null)} onUpdate={handleCarUpdate} />
    );
  }

  // Conditionally render RegisterMobile or RegisterDesktop based on isMobile
  return isMobile ? (
    <RegisterMobile onUpdate={onUpdate} />
  ) : (
    <RegisterDesktop onUpdate={onUpdate} />
  );
}

export default memo(CarRegistration);