"use client"

import { useState, useEffect } from "react"
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  TooltipProps,
  PieChart,
  Pie,
  Legend
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

type DocumentsChartProps = {
  documents?: any[]
  timeframe?: string
  startDate?: Date
  endDate?: Date
  invoicesCount?: number
  receiptsCount?: number
  deliveryNotesCount?: number
  proformaInvoicesCount?: number
}

export function DocumentsChart({ 
  documents, 
  timeframe, 
  startDate, 
  endDate,
  invoicesCount,
  receiptsCount,
  deliveryNotesCount,
  proformaInvoicesCount
}: DocumentsChartProps) {
  type ChartItem = {
    name: string;
    value: number;
    color: string;
  }

  const [chartData, setChartData] = useState<ChartItem[]>([])

  useEffect(() => {
    // If we have counts, create a pie chart data
    if (typeof invoicesCount !== 'undefined') {
      const data = [
        { name: "Invoices", value: invoicesCount ?? 0, color: "#3b82f6" },
        { name: "Receipts", value: receiptsCount ?? 0, color: "#22c55e" },
        { name: "Delivery Notes", value: deliveryNotesCount ?? 0, color: "#f59e0b" },
        { name: "Proforma", value: proformaInvoicesCount ?? 0, color: "#a855f7" }
      ].filter((item): item is ChartItem => item.value > 0)
      
      setChartData(data)
      return
    }

    // If we don't have documents data, return empty
    if (!documents || !documents.length || !timeframe || !startDate || !endDate) {
      setChartData([])
      return
    }
    // Monthly data
    const months = eachMonthOfInterval({ start: startDate, end: endDate })
    
    const data = months.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      
      const monthDocs = documents.filter(doc => {
        const docDate = parseISO(doc.createdAt)
        return docDate >= monthStart && docDate <= monthEnd
      })
      
      const invoices = monthDocs.filter(doc => doc.type === "invoices").length
      const receipts = monthDocs.filter(doc => doc.type === "receipts").length
      const deliveryNotes = monthDocs.filter(doc => doc.type === "deliveryNotes").length
      const proformaInvoices = monthDocs.filter(doc => doc.type === "proformaInvoices").length
      
      return {
        date: month,
        invoices,
        receipts,
        deliveryNotes,
        proformaInvoices,
        formattedDate: format(month, "MMM yyyy")
      }
    })

    setChartData(chartData)
  }, [documents, timeframe, startDate, endDate, invoicesCount, receiptsCount, deliveryNotesCount, proformaInvoicesCount])

  // If we have counts, render a pie chart
  if (typeof invoicesCount !== 'undefined') {
    if (chartData.length === 0) {
      return (
        <div className="flex justify-center items-center h-[250px] text-muted-foreground">
          No documents created yet
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
            <Tooltip 
              formatter={(value) => [`${value} documents`, "Count"]}
              content={<PieTooltip />}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Otherwise render a bar chart
  if (chartData.length === 0) {
    return (
      <div className="flex justify-center items-center h-[350px] text-muted-foreground">
        No document data available for the selected period
      </div>
    )
  }

  return (
    <ChartContainer
      config={{
        invoices: {
          label: "Invoices",
          color: "#3b82f6",
        },
        receipts: {
          label: "Receipts",
          color: "#22c55e",
        },
        deliveryNotes: {
          label: "Delivery Notes",
          color: "#f59e0b",
        },
        proformaInvoices: {
          label: "Proforma",
          color: "#a855f7",
        },
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="formattedDate" />
          <YAxis allowDecimals={false} />
          <ChartTooltip content={<CustomTooltip />} />
          <Bar dataKey="invoices" stackId="a" fill="#3b82f6" name="Invoices" />
          <Bar dataKey="receipts" stackId="a" fill="#22c55e" name="Receipts" />
          <Bar dataKey="deliveryNotes" stackId="a" fill="#f59e0b" name="Delivery Notes" />
          <Bar dataKey="proformaInvoices" stackId="a" fill="#a855f7" name="Proforma" />
          <Legend />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function CustomTooltip({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + entry.value, 0)
    
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-2">
          <div className="text-sm font-medium mb-1">{label}</div>
          {payload.map((entry, index) => (
            <div key={index} className="text-xs flex justify-between items-center">
              <div className="flex items-center">
                <div 
                  className="w-2 h-2 rounded-full mr-1" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span>{entry.name}:</span>
              </div>
              <span className="font-medium ml-2">{entry.value}</span>
            </div>
          ))}
          <div className="text-xs font-semibold mt-1 pt-1 border-t">
            Total: {total}
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

function PieTooltip({ active, payload }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-2">
          <div className="text-sm font-medium">{payload[0].name}</div>
          <div className="text-sm font-semibold">
            {payload[0].value} documents
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
