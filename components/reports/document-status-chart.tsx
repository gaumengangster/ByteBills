"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, TooltipProps } from "recharts"
import { Card, CardContent } from "@/components/ui/card"

type DocumentStatusChartProps = {
  documents: any[]
}

export function DocumentStatusChart({ documents }: DocumentStatusChartProps) {
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    if (!documents.length) {
      setChartData([])
      return
    }

    // Count documents by status
    const statusCounts: Record<string, number> = {}
    
    documents.forEach(doc => {
      const status = doc.status || "unknown"
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })
    
    // Map to chart data format
    const data = Object.entries(statusCounts).map(([status, count]) => ({
      name: formatStatus(status),
      value: count,
      color: getStatusColor(status)
    }))
    
    setChartData(data)
  }, [documents])

  const formatStatus = (status: string): string => {
    switch (status.toLowerCase()) {
      case "draft":
        return "Draft"
      case "sent":
        return "Sent"
      case "paid":
        return "Paid"
      case "overdue":
        return "Overdue"
      case "cancelled":
        return "Cancelled"
      default:
        return "Unknown"
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "draft":
        return "#94a3b8" // slate-400
      case "sent":
        return "#3b82f6" // blue-500
      case "paid":
        return "#22c55e" // green-500
      case "overdue":
        return "#ef4444" // red-500
      case "cancelled":
        return "#f97316" // orange-500
      default:
        return "#cbd5e1" // slate-300
    }
  }

  if (chartData.length === 0) {
    return (
      <div className="flex justify-center items-center h-[250px] text-muted-foreground">
        No invoice status data available
      </div>
    )
  }

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<StatusTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
        {chartData.map((entry, index) => (
          <div key={index} className="flex items-center">
            <div 
              className="w-3 h-3 rounded-full mr-1" 
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-xs">{entry.name}</span>
          </div>
        ))}
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
          <div className="text-sm font-semibold">
            {payload[0].value} invoices
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
