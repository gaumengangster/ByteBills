"use client"

import { useState, useEffect, useMemo } from "react"
import { Bar, XAxis, YAxis, CartesianGrid, Legend, TooltipProps, Line, ComposedChart } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { getDocumentChartDate, getRevenueDocumentDate } from "@/lib/revenue-document-date"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  buildRevenueYTicks,
  formatCurrencyAxisCompact,
  formatRevenueFull,
} from "@/lib/format-chart-axis"
import { invoiceTotalEurForReport } from "@/lib/revenue-document-eur"

import { getDisplayCurrency } from "@/lib/env-public"

const DISPLAY_CURRENCY = getDisplayCurrency()

type MonthlyComparisonChartProps = {
  documents: any[]
  timeframe: string
  startDate: Date
  endDate: Date
}

export function MonthlyComparisonChart({
  documents,
  timeframe,
  startDate,
  endDate,
}: MonthlyComparisonChartProps) {
  const [chartData, setChartData] = useState<any[]>([])

  const revenueDocumentsForCurrency = useMemo(() => {
    return documents.filter((doc) => {
      if (doc.type !== "invoices") return false
      const te = invoiceTotalEurForReport(doc as Record<string, unknown>)
      if (!Number.isFinite(te)) return false
      const d = getRevenueDocumentDate(doc)
      return !Number.isNaN(d.getTime())
    })
  }, [documents])

  useEffect(() => {
    if (!documents.length) {
      setChartData([])
      return
    }

    const revenueDocuments = revenueDocumentsForCurrency

    // Monthly data
    const months = eachMonthOfInterval({ start: startDate, end: endDate })
    
    const data = months.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      
      const monthDocs = documents.filter((doc) => {
        const docDate = getDocumentChartDate(doc)
        return !Number.isNaN(docDate.getTime()) && docDate >= monthStart && docDate <= monthEnd
      })
      
      const monthRevenueDocs = revenueDocuments.filter((doc) => {
        const docDate = getRevenueDocumentDate(doc)
        return !Number.isNaN(docDate.getTime()) && docDate >= monthStart && docDate <= monthEnd
      })
      
      const documentCount = monthDocs.length
      const revenue = monthRevenueDocs.reduce(
        (sum, doc) => sum + invoiceTotalEurForReport(doc as Record<string, unknown>),
        0,
      )
      
      return {
        date: month,
        documentCount,
        revenue,
        formattedDate: format(month, "MMM yyyy")
      }
    })

    setChartData(data)
  }, [documents, timeframe, startDate, endDate, revenueDocumentsForCurrency])

  const maxRevenue = chartData.length ? Math.max(0, ...chartData.map((d) => d.revenue ?? 0)) : 0
  const revenueYTicks = buildRevenueYTicks(maxRevenue)
  const revenueYMax = revenueYTicks[revenueYTicks.length - 1] ?? 1

  if (chartData.length === 0) {
    return (
      <div className="flex justify-center items-center h-[350px] text-muted-foreground">
        No data available for the selected period
      </div>
    )
  }

  return (
    <div className="h-full min-h-[300px] w-full min-w-0 max-w-full overflow-hidden">
      <ChartContainer
        className="aspect-auto h-full w-full min-h-0 min-w-0 max-w-full [&_.recharts-responsive-container]:!max-w-full"
        config={{
          revenue: {
            label: "Invoice revenue",
            color: "hsl(var(--chart-1))",
          },
          documentCount: {
            label: "Documents",
            color: "hsl(var(--chart-2))",
          },
        }}
      >
        <ComposedChart data={chartData} margin={{ top: 20, right: 24, left: 4, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="formattedDate" interval="preserveStartEnd" />
          <YAxis
            yAxisId="left"
            orientation="left"
            domain={[0, revenueYMax]}
            ticks={revenueYTicks}
            tickFormatter={(value) => formatCurrencyAxisCompact(value, DISPLAY_CURRENCY)}
            width={72}
          />
          <YAxis yAxisId="right" orientation="right" allowDecimals={false} width={40} />
          <ChartTooltip content={(props) => <CustomTooltip {...props} currency={DISPLAY_CURRENCY} />} />
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
            name="Invoice revenue"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Legend />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipProps<any, any> & { currency: string }) {
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
                {entry.name === "Invoice revenue"
                  ? formatRevenueFull(Number(entry.value), currency)
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
