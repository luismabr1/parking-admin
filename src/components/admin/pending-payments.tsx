"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Car,
  User,
  Phone,
  Building2,
  Hash,
  ImageIcon,
  ExternalLink,
  Calculator,
  TrendingUp,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import ExitTimeDisplay from "./exit-time-display"

interface PaymentInfo {
  _id: string
  codigoTicket: string
  referenciaTransferencia: string
  banco: string
  telefono: string
  numeroIdentidad: string
  montoPagado: number
  montoPagadoUsd?: number
  fechaPago: string
  estado: string
  estadoValidacion: string
  tipoPago: string
  urlImagenComprobante?: string
  carInfo: {
    placa: string
    marca: string
    modelo: string
    color: string
    nombreDueño: string
    telefono: string
    imagenes?: string[]
  }
  tiempoSalida?: string
  tiempoSalidaEstimado?: string
  montoCalculado?: number
  tasaCambioUsada?: number
  duracionMinutos?: number
}

interface CompanySettings {
  nombreEmpresa?: string
  moneda?: string
  tasaCambio?: number
  tarifaPorHora?: number
}

type PendingPaymentsProps = {}

const PendingPaymentCard: React.FC<{
  payment: PaymentInfo
  onValidate: (id: string) => void
  onReject: (id: string) => void
  companySettings: CompanySettings
  isProcessing: boolean
}> = React.memo(({ payment, onValidate, onReject, companySettings, isProcessing }) => {
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  // Validation: Check that payment._id is present
  if (!payment._id) {
    console.warn("⚠️ [PENDING-PAYMENT-CARD] Payment object missing _id:", payment)
    return <div>Error: Datos de pago inválidos (falta _id)</div>
  }

  const getPaymentTypeColor = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case "transferencia":
        return "bg-blue-100 text-blue-800"
      case "pago_movil":
        return "bg-green-100 text-green-800"
      case "efectivo":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatPaymentType = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case "transferencia":
        return "Transferencia"
      case "pago_movil":
        return "Pago Móvil"
      case "efectivo":
        return "Efectivo"
      default:
        return tipo || "No especificado"
    }
  }

  const formatAmount = (amount: number, isMainAmount = true) => {
    if (!amount || isNaN(amount)) return "0.00"

    const isElectronicPayment = ["pago_movil", "transferencia"].includes(payment.tipoPago?.toLowerCase())

    if (isElectronicPayment) {
      if (isMainAmount) {
        return `Bs. ${amount.toLocaleString("es-VE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      } else {
        const usdAmount =
          payment.montoPagadoUsd || amount / (payment.tasaCambioUsada || companySettings.tasaCambio || 36)
        return `$${usdAmount.toFixed(2)} USD`
      }
    } else {
      return `$${amount.toFixed(2)} USD`
    }
  }

  const getCalculationFormula = () => {
    const tarifaPorHora = companySettings.tarifaPorHora || 2.0
    const duracion = payment.duracionMinutos || 0
    const horas = Math.ceil(duracion / 60) || 1
    const montoUSD = tarifaPorHora * horas

    const isElectronicPayment = ["pago_movil", "transferencia"].includes(payment.tipoPago?.toLowerCase())

    if (isElectronicPayment) {
      const tasaCambio = payment.tasaCambioUsada || companySettings.tasaCambio || 36
      const montoBs = montoUSD * tasaCambio

      return {
        formula: `$${tarifaPorHora}/hora × ${horas} hora${horas > 1 ? "s" : ""} × ${tasaCambio} Bs/$`,
        calculation: `$${montoUSD.toFixed(2)} × ${tasaCambio} = Bs. ${montoBs.toLocaleString("es-VE", {
          minimumFractionDigits: 2,
        })}`,
        result: `Bs. ${montoBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
        usdReference: `($${montoUSD.toFixed(2)} USD)`,
        exchangeRate: tasaCambio,
      }
    } else {
      return {
        formula: `$${tarifaPorHora}/hora × ${horas} hora${horas > 1 ? "s" : ""}`,
        calculation: `$${tarifaPorHora} × ${horas} = $${montoUSD.toFixed(2)}`,
        result: `$${montoUSD.toFixed(2)} USD`,
        usdReference: null,
        exchangeRate: null,
      }
    }
  }

  const calculationInfo = getCalculationFormula()
  const isElectronicPayment = ["pago_movil", "transferencia"].includes(payment.tipoPago?.toLowerCase())

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Ticket: {payment.codigoTicket}
            </CardTitle>
            <Badge className={getPaymentTypeColor(payment.tipoPago)} variant="secondary">
              {formatPaymentType(payment.tipoPago)}
            </Badge>
          </div>
          {(payment.tiempoSalida || payment.tiempoSalidaEstimado) && (
            <div className="mt-2">
              <ExitTimeDisplay
                tiempoSalida={payment.tiempoSalida}
                tiempoSalidaEstimado={payment.tiempoSalidaEstimado}
                fechaPago={payment.fechaPago}
                codigoTicket={payment.codigoTicket}
                variant="compact"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Car className="h-4 w-4 text-gray-600" />
              <span className="font-semibold text-gray-900">{payment.carInfo?.placa || "Placa no disponible"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <span>
                {payment.carInfo?.marca || "N/A"} {payment.carInfo?.modelo || ""}
              </span>
              <span>{payment.carInfo?.color || "N/A"}</span>
            </div>
            {payment.carInfo?.nombreDueño && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <User className="h-3 w-3" />
                <span>{payment.carInfo.nombreDueño}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Monto Pagado:</span>
              <div className="text-right">
                <div className="font-bold text-green-600">{formatAmount(payment.montoPagado, true)}</div>
                {isElectronicPayment && (
                  <div className="text-xs text-gray-500">{formatAmount(payment.montoPagado, false)}</div>
                )}
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Cálculo del Monto:</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="text-gray-700">{calculationInfo.formula}</div>
                <div className="text-gray-600">{calculationInfo.calculation}</div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Monto Calculado:</span>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">{calculationInfo.result}</div>
                    {calculationInfo.usdReference && (
                      <div className="text-xs text-gray-500">{calculationInfo.usdReference}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {isElectronicPayment && calculationInfo.exchangeRate && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Tasa de Cambio:</span>
                </div>
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Tasa usada:</span>
                    <span className="font-bold text-yellow-700">
                      {calculationInfo.exchangeRate.toLocaleString("es-VE")} Bs/$
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Fecha del pago: {new Date(payment.fechaPago).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-1 gap-2 text-sm">
              {payment.referenciaTransferencia && (
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3" />
                  <span className="text-gray-600">Ref:</span>
                  <span className="font-mono">{payment.referenciaTransferencia}</span>
                </div>
              )}
              {payment.banco && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  <span className="text-gray-600">Banco:</span>
                  <span>{payment.banco}</span>
                </div>
              )}
              {payment.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  <span className="text-gray-600">Teléfono:</span>
                  <span>{payment.telefono}</span>
                </div>
              )}
              {payment.numeroIdentidad && (
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span className="text-gray-600">Cédula:</span>
                  <span>{payment.numeroIdentidad}</span>
                </div>
              )}
              {payment.urlImagenComprobante && (
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" />
                  <span className="text-gray-600">Comprobante:</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-blue-600 hover:text-blue-800"
                    onClick={() => setShowReceiptModal(true)}
                  >
                    Ver comprobante
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>Pago realizado: {new Date(payment.fechaPago).toLocaleString("es-ES")}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                console.log("🔍 [PENDING-PAYMENT-CARD] Validating payment with ID:", payment._id)
                onValidate(payment._id)
              }}
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validar Pago
            </Button>
            <Button
              onClick={() => {
                console.log("🔍 [PENDING-PAYMENT-CARD] Rejecting payment with ID:", payment._id)
                onReject(payment._id)
              }}
              disabled={isProcessing}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
          </div>
        </CardContent>
      </Card>
      {showReceiptModal && payment.urlImagenComprobante && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Comprobante de Pago - {payment.codigoTicket}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowReceiptModal(false)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <img
                src={payment.urlImagenComprobante || "/placeholder.svg"}
                alt={`Comprobante de pago ${payment.codigoTicket}`}
                className="w-full h-auto rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "/placeholder.svg?height=400&width=300&text=Error+cargando+imagen"
                }}
              />
              <div className="mt-4 text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Referencia:</strong> {payment.referenciaTransferencia}
                </p>
                <p>
                  <strong>Banco:</strong> {payment.banco}
                </p>
                <p>
                  <strong>Monto:</strong> {formatAmount(payment.montoPagado, true)}
                </p>
                {isElectronicPayment && (
                  <>
                    <p>
                      <strong>Equivalente:</strong> {formatAmount(payment.montoPagado, false)}
                    </p>
                    <p>
                      <strong>Tasa:</strong> {payment.tasaCambioUsada?.toLocaleString("es-VE")} Bs/$
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

PendingPaymentCard.displayName = "PendingPaymentCard"

const PendingPayments: React.FC<PendingPaymentsProps> = () => {
  const [payments, setPayments] = useState<PaymentInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingPayments, setProcessingPayments] = useState<Set<string>>(new Set())
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    nombreEmpresa: "Estacionamiento",
    moneda: "VES",
    tasaCambio: 36.0,
    tarifaPorHora: 2.0,
  })
  const isFetchingRef = useRef(false)

  const fetchCompanySettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/company-settings")
      if (response.ok) {
        const settings = await response.json()
        setCompanySettings({
          nombreEmpresa: settings.nombreEmpresa || "Estacionamiento",
          moneda: settings.moneda || "VES",
          tasaCambio: settings.tasaCambio || 36.0,
          tarifaPorHora: settings.tarifaPorHora || 2.0,
        })
      }
    } catch (error) {
      console.error("Error fetching company settings:", error)
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    if (isFetchingRef.current) return

    isFetchingRef.current = true
    try {
      const response = await fetch(`/api/admin/pending-payments?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        console.log("🔍 [PENDING-PAYMENTS] Payments received:", data)
        // Validation: Ensure each payment has _id
        const validPayments = data.map((p) => {
          if (!p._id) {
            console.warn("⚠️ [PENDING-PAYMENTS] Payment missing _id, using codigoTicket as fallback:", p.codigoTicket)
            return { ...p, _id: p.codigoTicket } // Temporary fallback
          }
          return p
        })
        setPayments(validPayments)
      }
    } catch (error) {
      console.error("Error fetching pending payments:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los pagos pendientes",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  const validatePayment = useCallback(
    async (paymentId: string) => {
      // Validation: Ensure paymentId is valid
      if (!paymentId) {
        console.error("❌ [PENDING-PAYMENTS] Invalid paymentId:", paymentId)
        toast({
          title: "Error",
          description: "ID de pago inválido",
          variant: "destructive",
        })
        return
      }
      console.log("🔍 [PENDING-PAYMENTS] Validating payment with ID:", paymentId)
      setProcessingPayments((prev) => new Set(prev).add(paymentId))

      try {
        const response = await fetch("/api/admin/validate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pagoId: paymentId, // Changed from paymentId to pagoId to match backend expectation
            currentPrecioHora: companySettings.tarifaPorHora || 2.0,
            currentTasaCambio: companySettings.tasaCambio || 36.0,
          }),
        })

        if (response.ok) {
          const result = await response.json()
          toast({
            title: "Pago Validado",
            description: result.message || "El pago ha sido validado exitosamente",
          })
          await fetchPayments()
          // Stats will update automatically via SSE
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || errorData.message || "Error validating payment")
        }
      } catch (error) {
        console.error("Error validating payment:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudo validar el pago",
          variant: "destructive",
        })
      } finally {
        setProcessingPayments((prev) => {
          const newSet = new Set(prev)
          newSet.delete(paymentId)
          return newSet
        })
      }
    },
    [fetchPayments, companySettings],
  )

  const rejectPayment = useCallback(
    async (paymentId: string) => {
      if (!paymentId) {
        console.error("❌ [PENDING-PAYMENTS] Invalid paymentId for rejection:", paymentId)
        toast({
          title: "Error",
          description: "ID de pago inválido",
          variant: "destructive",
        })
        return
      }
      console.log("🔍 [PENDING-PAYMENTS] Rejecting payment with ID:", paymentId)
      setProcessingPayments((prev) => new Set(prev).add(paymentId))

      try {
        const response = await fetch("/api/admin/reject-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pagoId: paymentId }), // Changed from paymentId to pagoId
        })

        if (response.ok) {
          const result = await response.json()
          toast({
            title: "Pago Rechazado",
            description: result.message || "El pago ha sido rechazado",
            variant: "destructive",
          })
          await fetchPayments()
          // Stats will update automatically via SSE
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || errorData.message || "Error rejecting payment")
        }
      } catch (error) {
        console.error("Error rejecting payment:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudo rechazar el pago",
          variant: "destructive",
        })
      } finally {
        setProcessingPayments((prev) => {
          const newSet = new Set(prev)
          newSet.delete(paymentId)
          return newSet
        })
      }
    },
    [fetchPayments],
  )

  const sortByUrgency = useCallback((a: PaymentInfo, b: PaymentInfo) => {
    const getUrgencyScore = (payment: PaymentInfo) => {
      if (!payment.tiempoSalida && !payment.tiempoSalidaEstimado) return 0

      const exitTime = new Date(payment.tiempoSalida || payment.tiempoSalidaEstimado || "")
      const now = new Date()
      const diffMinutes = (exitTime.getTime() - now.getTime()) / (1000 * 60)

      if (diffMinutes < 0) return 4 // Critical - time has passed
      if (diffMinutes < 15) return 3 // Very urgent
      if (diffMinutes < 30) return 2 // Urgent
      if (diffMinutes < 60) return 1 // Moderate
      return 0 // Normal
    }

    return getUrgencyScore(b) - getUrgencyScore(a)
  }, [])

  const sortedPayments = useMemo(() => {
    return [...payments].sort(sortByUrgency)
  }, [payments, sortByUrgency])

  useEffect(() => {
    fetchCompanySettings()
    fetchPayments()
    const interval = setInterval(fetchPayments, 30000)
    return () => clearInterval(interval)
  }, [fetchCompanySettings, fetchPayments])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pagos Pendientes de Validación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagos Pendientes de Validación
              </CardTitle>
              <CardDescription>
                {sortedPayments.length} pago{sortedPayments.length !== 1 ? "s" : ""} esperando validación
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchPayments} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
      </Card>
      {sortedPayments.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo al día!</h3>
              <p className="text-gray-600">No hay pagos pendientes de validación en este momento.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedPayments.map((payment) => (
            <PendingPaymentCard
              key={payment._id}
              payment={payment}
              onValidate={validatePayment}
              onReject={rejectPayment}
              companySettings={companySettings}
              isProcessing={processingPayments.has(payment._id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

PendingPayments.displayName = "PendingPayments"

export default React.memo(PendingPayments)
