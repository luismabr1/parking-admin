"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  Car,
  CreditCard,
  CheckCircle,
  Clock,
  Ticket,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useRealTimeStats } from "@/hooks/use-real-time-stats"

export default function MobileStats() {
  const { stats, isLoading, isConnected, connectionStatus, error, refetch } = useRealTimeStats()
  const [isExpanded, setIsExpanded] = useState(false)

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-600" />
      case "loading":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case "disconnected":
        return <WifiOff className="h-4 w-4 text-red-600" />
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />
    }
  }

  const getConnectionText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Conectado"
      case "loading":
        return "Cargando..."
      case "disconnected":
        return "Desconectado"
      default:
        return "Sin conexión"
    }
  }

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-600"
      case "loading":
        return "text-blue-600"
      case "disconnected":
        return "text-red-600"
      default:
        return "text-gray-400"
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg">Estadísticas</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {stats.availableTickets} libres
              </Badge>
              {stats.pendingConfirmations > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.pendingConfirmations} pendientes
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              {getConnectionIcon()}
              <span className={`text-xs ${getConnectionColor()}`}>{getConnectionText()}</span>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                refetch()
              }}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="h-8 px-2 bg-transparent"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </div>
        {error && <div className="text-xs text-red-600 mt-1">Error: {error}</div>}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            {/* Pagos Pendientes */}
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Pagos</span>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {stats.pendingPayments}
                </Badge>
              </div>
              <p className="text-xs text-orange-600 mt-1">Pendientes</p>
            </div>

            {/* Confirmaciones Pendientes */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Confirmar</span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {stats.pendingConfirmations}
                </Badge>
              </div>
              <p className="text-xs text-blue-600 mt-1">Estacionamientos</p>
            </div>

            {/* Carros Estacionados */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Car className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Carros</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {stats.carsParked}
                </Badge>
              </div>
              <p className="text-xs text-green-600 mt-1">Estacionados</p>
            </div>

            {/* Tickets Pagados */}
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Listos</span>
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  {stats.paidTickets}
                </Badge>
              </div>
              <p className="text-xs text-purple-600 mt-1">Para salir</p>
            </div>
          </div>

          {/* Información adicional */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Ticket className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-600">Disponibles</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{stats.availableTickets}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Users className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-600">Personal</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{stats.totalStaff}</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <CreditCard className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-600">Hoy</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{stats.todayPayments}</p>
            </div>
          </div>

          {/* Indicador de última actualización */}
          <div className="text-center pt-2 border-t">
            <p className="text-xs text-gray-500">Actualización automática por eventos</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
