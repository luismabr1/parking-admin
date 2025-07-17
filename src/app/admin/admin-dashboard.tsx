"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Smartphone,
  MoreHorizontal,
} from "lucide-react";
import PendingPayments from "../../components/admin/pending-payments";
import StaffManagement from "../../components/admin/staff-management";
import CompanySettings from "../../components/admin/company-settings";
import TicketManagement from "../../components/admin/ticket-management";
import CarRegistration from "../../components/admin/car-registration";
import CarHistory from "../../components/admin/car-history";
import VehicleExit from "../../components/admin/vehicle-exit";
import QRGenerator from "../../components/admin/qr-generator";
import ParkingConfirmation from "../../components/admin/parking-confirmation";
import { Badge } from "@/components/ui/badge";
import { useMobileDetection } from "@/hooks/use-mobile-detection";
import React, { useMemo } from "react";
import NotificationSettings from "@/components/notification/notification-settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardStats {
  pendingPayments: number;
  totalStaff: number;
  todayPayments: number;
  totalTickets: number;
  availableTickets: number;
  carsParked: number;
  paidTickets: number;
  pendingConfirmations: number;
}

const areStatsEqual = (newStats: DashboardStats, oldStats: DashboardStats) => {
  return Object.keys(newStats).every(
    (key) => newStats[key as keyof DashboardStats] === oldStats[key as keyof DashboardStats],
  );
};

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingPayments: 0,
    totalStaff: 0,
    todayPayments: 0,
    totalTickets: 0,
    availableTickets: 0,
    carsParked: 0,
    paidTickets: 0,
    pendingConfirmations: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const isMobile = useMobileDetection();
  const [activeTab, setActiveTab] = useState("cars");
  const [visibleTabs, setVisibleTabs] = useState<string[]>([]);
  const prevStatsRef = useRef(stats);
  const prevMobileRef = useRef(isMobile);
  const renderCountRef = useRef(0);

  // Log renders
  renderCountRef.current += 1;
  if (process.env.NODE_ENV === "development") {
    console.log(`🔍 DEBUG: Renderizando AdminDashboard #${renderCountRef.current}`);
    console.log(`🔍 DEBUG: activeTab actual: ${activeTab}`);
  }

  // Log state changes
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `🔍 DEBUG: Estado actualizado en AdminDashboard - activeTab: ${activeTab}, showStats: ${showStats}, isLoadingStats: ${isLoadingStats}, stats.pendingPayments: ${stats.pendingPayments}`,
      );
    }
  }, [activeTab, showStats, isLoadingStats, stats]);

  // Log isMobile changes
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 DEBUG: isMobile cambió: ${isMobile}`);
    }
  }, [isMobile]);

  const fetchStats = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 DEBUG: Iniciando fetchStats");
      }
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/admin/stats?t=${timestamp}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        next: { revalidate: 0 },
      });

      if (response.ok) {
        const data = await response.json();
        setIsLoadingStats(false);
        if (!areStatsEqual(data, prevStatsRef.current)) {
          setStats(data);
          prevStatsRef.current = data;
          if (process.env.NODE_ENV === "development") {
            console.log("🔍 DEBUG: Stats actualizadas", data);
          }
        } else {
          if (process.env.NODE_ENV === "development") {
            console.log("🔍 DEBUG: Omitiendo actualización de stats, datos idénticos");
          }
        }
      } else {
        throw new Error("Error fetching stats");
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleTabChange = (value: string) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 DEBUG: Cambiando tab de ${activeTab} a ${value}`);
    }
    setActiveTab(value);
  };

  useEffect(() => {
    if (prevMobileRef.current !== isMobile) {
      setActiveTab("cars");
      if (process.env.NODE_ENV === "development") {
        console.log(`🔍 DEBUG: Actualizando activeTab a cars por cambio en isMobile`);
      }
      prevMobileRef.current = isMobile;
    }
  }, [isMobile]);

  // Actualizar visibleTabs solo en el cliente
  useEffect(() => {
    const allTabs = [
      "confirmations",
      "payments",
      "tickets",
      "cars",
      "exit",
      "qr",
      "history",
      "staff",
      "settings",
      "notifications",
    ];
    const updateVisibleTabs = () => {
      if (isMobile || window.innerWidth < 640) {
        setVisibleTabs(["cars", "confirmations", "payments", "exit"]);
      } else {
        const width = window.innerWidth;
        let maxTabs = width >= 1000 ? 8 : 4;
        setVisibleTabs(allTabs.slice(0, maxTabs));
      }
    };

    updateVisibleTabs();
    window.addEventListener("resize", updateVisibleTabs);
    return () => window.removeEventListener("resize", updateVisibleTabs);
  }, [isMobile]);

  const hiddenTabs = useMemo(() => {
    const allTabs = [
      "confirmations",
      "payments",
      "tickets",
      "cars",
      "exit",
      "qr",
      "history",
      "staff",
      "settings",
      "notifications",
    ];
    return allTabs.filter((tab) => !visibleTabs.includes(tab));
  }, [visibleTabs]);

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Panel Admin</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Gestión de estacionamiento</p>
          </div>
          <Button onClick={fetchStats} variant="outline" size="sm" disabled={isLoadingStats}>
            <RefreshCw className={`h-4 w-4 ${isLoadingStats ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="py-2 px-4 cursor-pointer" onClick={() => setShowStats(!showStats)}>
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">
                Estadísticas{" "}
                <Badge variant="outline" className="ml-2">
                  {stats.availableTickets} libres
                </Badge>
                {stats.pendingConfirmations > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {stats.pendingConfirmations} pendientes
                  </Badge>
                )}
              </CardTitle>
              {showStats ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </CardHeader>
          {showStats && (
            <CardContent className="py-2 px-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Espacios libres:</span>
                  <Badge variant="outline">{stats.availableTickets}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Estacionados:</span>
                  <Badge variant="secondary">{stats.carsParked}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Confirmaciones:</span>
                  <Badge variant={stats.pendingConfirmations > 0 ? "destructive" : "outline"}>
                    {stats.pendingConfirmations}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Pagos pendientes:</span>
                  <Badge variant={stats.pendingPayments > 0 ? "destructive" : "outline"}>{stats.pendingPayments}</Badge>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-row w-full justify-between gap-1">
            <TabsTrigger
              value="cars"
              className="py-2 px-4 text-sm relative flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary text-center"
            >
              <Smartphone className="h-3 w-3 mr-1" /> Registro
            </TabsTrigger>
            <TabsTrigger
              value="confirmations"
              className="py-2 px-4 text-sm relative flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary text-center"
            >
              Confirmar
              {stats.pendingConfirmations > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs font-bold min-w-[16px] rounded-full"
                >
                  {stats.pendingConfirmations}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="py-2 px-4 text-sm relative flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary text-center"
            >
              Pagos
              {stats.pendingPayments > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs font-bold min-w-[16px] rounded-full"
                >
                  {stats.pendingPayments}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="exit"
              className="py-2 px-4 text-sm relative flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary text-center"
            >
              Salida
              {stats.paidTickets > 0 && (
                <Badge
                  variant="default"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs font-bold min-w-[16px] rounded-full"
                >
                  {stats.paidTickets}
                </Badge>
              )}
            </TabsTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="py-2 px-4 text-sm flex-1 h-auto data-[state=open]:bg-primary data-[state=open]:text-primary-foreground text-center"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  Más
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleTabChange("tickets")} className="cursor-pointer">
                  Espacios
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("qr")} className="cursor-pointer">
                  QR
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("history")} className="cursor-pointer">
                  Historial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("staff")} className="cursor-pointer">
                  Personal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("settings")} className="cursor-pointer">
                  Config
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange("notifications")} className="cursor-pointer">
                  Notificaciones
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsList>

          <TabsContent value="cars" className="m-0">
            <CarRegistration />
          </TabsContent>
          <TabsContent value="confirmations" className="m-0">
            <ParkingConfirmation />
          </TabsContent>
          <TabsContent value="payments" className="m-0">
            <PendingPayments onStatsUpdate={fetchStats} />
          </TabsContent>
          <TabsContent value="exit" className="m-0">
            <VehicleExit />
          </TabsContent>
          <TabsContent value="tickets" className="m-0">
            <TicketManagement />
          </TabsContent>
          <TabsContent value="qr" className="m-0">
            <QRGenerator />
          </TabsContent>
          <TabsContent value="history" className="m-0">
            <CarHistory />
          </TabsContent>
          <TabsContent value="staff" className="m-0">
            <StaffManagement onStatsUpdate={fetchStats} />
          </TabsContent>
          <TabsContent value="settings" className="m-0">
            <CompanySettings />
          </TabsContent>
          <TabsContent value="notifications" className="m-0">
            <NotificationSettings userType="admin" />
          </TabsContent>
        </Tabs>
        <Card className="mt-6">
          <CardContent>
            <NotificationSettings userType="admin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Panel de Administración</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">Gestión completa del sistema de estacionamiento</p>
        </div>
        <Button onClick={fetchStats} variant="outline" disabled={isLoadingStats}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingStats ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <Badge variant={stats.pendingPayments > 0 ? "destructive" : "secondary"}>{stats.pendingPayments}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingPayments === 0 ? "Todos procesados" : "Requieren validación"}
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Confirmaciones</CardTitle>
            <Badge variant={stats.pendingConfirmations > 0 ? "destructive" : "secondary"}>
              {stats.pendingConfirmations}
            </Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.pendingConfirmations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingConfirmations === 0 ? "Todos confirmados" : "Pendientes"}
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Personal Activo</CardTitle>
            <Badge variant="secondary">{stats.totalStaff}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.totalStaff}</div>
            <p className="text-xs text-muted-foreground">Usuarios registrados</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Pagos Hoy</CardTitle>
            <Badge>{stats.todayPayments}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.todayPayments}</div>
            <p className="text-xs text-muted-foreground">Procesados hoy</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Total Espacios</CardTitle>
            <Badge variant="outline">{stats.totalTickets}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">Espacios totales</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Espacios Libres</CardTitle>
            <Badge variant="secondary">{stats.availableTickets}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.availableTickets}</div>
            <p className="text-xs text-muted-foreground">Disponibles</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Carros Estacionados</CardTitle>
            <Badge variant="destructive">{stats.carsParked}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.carsParked}</div>
            <p className="text-xs text-muted-foreground">Actualmente</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-2">
            <CardTitle className="text-sm font-medium">Listos para Salir</CardTitle>
            <Badge variant={stats.paidTickets > 0 ? "default" : "secondary"}>{stats.paidTickets}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <div className="text-2xl font-bold">{stats.paidTickets}</div>
            <p className="text-xs text-muted-foreground">Pagados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 mb-6">
        <TabsList className="grid grid-cols-1 gap-1 bg-muted/20 p-1 rounded-lg">
          <div className="flex flex-row w-full justify-start gap-1">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="py-2 px-4 text-sm text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:font-semibold transition-all duration-200 ease-in-out flex-1 text-center"
              >
                {tab === "confirmations" && (
                  <>
                    Confirmar
                    {stats.pendingConfirmations > 0 && (
                      <Badge variant="destructive" className="ml-1 text-xs">
                        {stats.pendingConfirmations}
                      </Badge>
                    )}
                  </>
                )}
                {tab === "payments" && (
                  <>
                    Pagos
                    {stats.pendingPayments > 0 && (
                      <Badge variant="destructive" className="ml-1 text-xs">
                        {stats.pendingPayments}
                      </Badge>
                    )}
                  </>
                )}
                {tab === "tickets" && "Espacios"}
                {tab === "cars" && (
                  <>
                    <Smartphone className="h-3 w-3 mr-1" /> Registro
                  </>
                )}
                {tab === "exit" && (
                  <>
                    Salida
                    {stats.paidTickets > 0 && (
                      <Badge className="ml-1 text-xs">{stats.paidTickets}</Badge>
                    )}
                  </>
                )}
                {tab === "qr" && "QR"}
                {tab === "history" && "Historial"}
                {tab === "staff" && "Personal"}
                {tab === "settings" && "Config"}
                {tab === "notifications" && "Notificaciones"}
              </TabsTrigger>
            ))}
            {hiddenTabs.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="py-2 px-4 text-sm flex-1 h-auto data-[state=open]:bg-primary data-[state=open]:text-primary-foreground text-center"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    Más
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hiddenTabs.map((tab) => (
                    <DropdownMenuItem
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className="cursor-pointer"
                    >
                      {tab === "tickets" && "Espacios"}
                      {tab === "qr" && "QR"}
                      {tab === "history" && "Historial"}
                      {tab === "staff" && "Personal"}
                      {tab === "settings" && "Config"}
                      {tab === "notifications" && "Notificaciones"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </TabsList>

        <TabsContent value="confirmations">
          <ParkingConfirmation />
        </TabsContent>
        <TabsContent value="payments">
          <PendingPayments onStatsUpdate={fetchStats} />
        </TabsContent>
        <TabsContent value="tickets">
          <TicketManagement />
        </TabsContent>
        <TabsContent value="cars">
          <CarRegistration />
        </TabsContent>
        <TabsContent value="exit">
          <VehicleExit />
        </TabsContent>
        <TabsContent value="qr">
          <QRGenerator />
        </TabsContent>
        <TabsContent value="history">
          <CarHistory />
        </TabsContent>
        <TabsContent value="staff">
          <StaffManagement onStatsUpdate={fetchStats} />
        </TabsContent>
        <TabsContent value="settings">
          <CompanySettings />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSettings userType="admin" />
        </TabsContent>
      </Tabs>
      <Card className="mt-6">
        <CardContent>
          <NotificationSettings userType="admin" />
        </CardContent>
      </Card>
    </div>
  );
}

export default React.memo(AdminDashboard);