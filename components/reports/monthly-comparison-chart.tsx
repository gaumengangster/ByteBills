"use client"

import { useState, useEffect } from "react"
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Legend,
  TooltipProps,
  Line,
  ComposedChart
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"

type MonthlyComparisonChartProps = {
  documents: any[]
  timeframe: string
  startDate: Date
  endDate: Date
}

export function MonthlyComparisonChart({ documents, timeframe, startDate, endDate }: MonthlyComparisonChartProps) {
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    if (!documents.length) {
      setChartData([])
      return
    }

    // Filter only revenue-generating documents (invoices and receipts)
    const revenueDocuments = documents.filter(doc => 
      (doc.type === "invoices" || doc.type === "receipts") && doc.total
    )

    // Monthly data
    const months = eachMonthOfInterval({ start: startDate, end: endDate })
    
    const data = months.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      
      const monthDocs = documents.filter(doc => {
        const docDate = parseISO(doc.createdAt)
        return docDate >= monthStart && docDate <= monthEnd
      })
      
      const monthRevenueDocs = revenueDocuments.filter(doc => {
        const docDate = parseISO(doc.createdAt)
        return docDate >= monthStart && docDate <= monthEnd
      })
      
      const documentCount = monthDocs.length
      const revenue = monthRevenueDocs.reduce((sum, doc) => sum + doc.total, 0)
      
      return {
        date: month,
        documentCount,
        revenue,
        formattedDate: format(month, "MMM yyyy")
      }
    })

    setChartData(data)
  }, [documents, timeframe, startDate, endDate])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (chartData.length === 0) {
    return (
      <div className="flex justify-center items-center h-[350px] text-muted-foreground">
        No data available for the selected period
      </div>
    )
  }

  return (
    <ChartContainer
      config={{
        revenue: {
          label: "Revenue",
          color: "hsl(var(--chart-1))",
        },
        documentCount: {
          label: "Documents",
          color: "hsl(var(--chart-2))",
        },
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="formattedDate" />
          <YAxis 
            yAxisId="left" 
            orientation="left" 
            tickFormatter={(value) => formatCurrency(value)}
            width={80}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            allowDecimals={false}
          />
          <ChartTooltip content={<CustomTooltip />} />
          <Bar 
            yAxisId="right" 
            dataKey="documentCount" 
            fill="var(--color-documentCount)" 
            name="Documents" 
            barSize={30}
          />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="revenue" 
            stroke="var(--color-revenue)" 
            name="Revenue"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Legend />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function CustomTooltip({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
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
              <span className="font-medium ml-2">
                {entry.name === "Revenue" 
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(entry.value)
                  : entry.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return null
}
