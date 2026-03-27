"use client"

import { useState, useEffect, useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, TooltipProps } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type DocumentStatusChartProps = {
  documents: any[]
}

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "unknown", label: "Unknown" },
] as const

function normalizeStatus(doc: { status?: string }): string {
  const s = doc.status
  if (s == null || String(s).trim() === "") {
    return "unknown"
  }
  return String(s).toLowerCase()
}

function formatStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "draft":
      return "Draft"
    case "sent":
      return "Sent"
    case "pending":
      return "Pending"
    case "paid":
      return "Paid"
    case "overdue":
      return "Overdue"
    case "cancelled":
      return "Cancelled"
    case "unknown":
      return "Unknown"
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  }
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "draft":
      return "#94a3b8"
    case "sent":
      return "#3b82f6"
    case "pending":
      return "#eab308"
    case "paid":
      return "#22c55e"
    case "overdue":
      return "#ef4444"
    case "cancelled":
      return "#f97316"
    default:
      return "#cbd5e1"
  }
}

export function DocumentStatusChart({ documents }: DocumentStatusChartProps) {
  const [chartData, setChartData] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filteredDocuments = useMemo(() => {
    if (statusFilter === "all") {
      return documents
    }
    return documents.filter((doc) => normalizeStatus(doc) === statusFilter)
  }, [documents, statusFilter])

  useEffect(() => {
    if (!filteredDocuments.length) {
      setChartData([])
      return
    }

    const statusCounts: Record<string, number> = {}

    filteredDocuments.forEach((doc) => {
      const status = normalizeStatus(doc)
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    const data = Object.entries(statusCounts).map(([status, count]) => ({
      name: formatStatusLabel(status),
      value: count,
      color: getStatusColor(status),
    }))

    setChartData(data)
  }, [filteredDocuments])

  if (!documents.length) {
    return (
      <div className="flex justify-center items-center h-[250px] text-muted-foreground">
        No invoice status data available
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-center items-center h-[220px] text-muted-foreground">
          No invoices for this status in the selected period
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full" aria-label="Filter invoices by status">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-[250px] w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={76}
              paddingAngle={5}
              dataKey="value"
              label={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<StatusTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-1">
        {(() => {
          const total = chartData.reduce((s, e) => s + e.value, 0)
          return chartData.map((entry, index) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
            return (
              <div key={index} className="flex items-center max-w-full min-w-0">
                <div className="w-3 h-3 shrink-0 rounded-full mr-1" style={{ backgroundColor: entry.color }} />
                <span className="text-xs truncate" title={`${entry.name} ${pct}% (${entry.value})`}>
                  {entry.name} {pct}%
                </span>
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}

function StatusTooltip({ active, payload }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-2">
          <div className="text-sm font-medium">{payload[0].name}</div>
          <div className="text-sm font-semibold">{payload[0].value} invoices</div>
        </CardContent>
      </Card>
    )
  }

  return null
}
