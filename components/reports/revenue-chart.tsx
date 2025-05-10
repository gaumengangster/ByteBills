"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  TooltipProps
} from "recharts"
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth } from "date-fns"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type RevenueChartProps = {
  documents: any[]
  timeframe: string
  startDate: Date
  endDate: Date
}

export function RevenueChart({ documents, timeframe, startDate, endDate }: RevenueChartProps) {
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

    let data: any[] = []

    if (timeframe === "last30Days") {
      // Daily data for the last 30 days
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      
      data = days.map(day => {
        const dayDocs = revenueDocuments.filter(doc => {
          const docDate = parseISO(doc.createdAt)
          return isSameDay(docDate, day)
        })
        
        const dayRevenue = dayDocs.reduce((sum, doc) => sum + doc.total, 0)
        
        return {
          date: day,
          revenue: dayRevenue,
          formattedDate: format(day, "MMM d")
        }
      })
    } else {
      // Monthly data
      const months = eachMonthOfInterval({ start: startDate, end: endDate })
      
      data = months.map(month => {
        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(month)
        
        const monthDocs = revenueDocuments.filter(doc => {
          const docDate = parseISO(doc.createdAt)
          return docDate >= monthStart && docDate <= monthEnd
        })
        
        const monthRevenue = monthDocs.reduce((sum, doc) => sum + doc.total, 0)
        
        return {
          date: month,
          revenue: monthRevenue,
          formattedDate: format(month, "MMM yyyy")
        }
      })
    }

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
        No revenue data available for the selected period
      </div>
    )
  }

  return (
    <div className="h-[350px]">
      <ChartContainer
        config={{
          revenue: {
            label: "Revenue",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value)}
              width={80}
            />
            <ChartTooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: TooltipProps<any, any>) {
  if (active && payload && payload.length) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-2">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-sm font-semibold text-primary">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(payload[0].value)}
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
