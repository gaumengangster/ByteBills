"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, TooltipProps, LabelList } from "recharts"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
  getYear,
} from "date-fns"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  buildRevenueYTicks,
  formatCurrencyAxisCompact,
  formatRevenueFull,
} from "@/lib/format-chart-axis"
import { getRevenueDocumentDate } from "@/lib/revenue-document-date"
import { invoiceTotalEurForReport } from "@/lib/revenue-document-eur"

import { getDisplayCurrency } from "@/lib/env-public"

const DISPLAY_CURRENCY = getDisplayCurrency()

type RevenueChartProps = {
  documents: any[]
  timeframe: string
  startDate: Date
  endDate: Date
}

export function RevenueChart({ documents, timeframe, startDate, endDate }: RevenueChartProps) {
  const [chartData, setChartData] = useState<any[]>([])

  const revenueDocumentsForCurrency = useMemo(() => {
    return documents.filter((doc) => {
      if (doc.type !== "invoices") return false
      const row = doc as Record<string, unknown>
      const te = invoiceTotalEurForReport(row)
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

    // Invoices only; group by invoice date.
    const revenueDocuments = revenueDocumentsForCurrency

    let data: any[] = []

    if (timeframe === "last30Days") {
      // Daily data for the last 30 days
      const days = eachDayOfInterval({ start: startDate, end: endDate })
      
      data = days.map(day => {
        const dayDocs = revenueDocuments.filter((doc) => {
          const docDate = getRevenueDocumentDate(doc)
          return isSameDay(docDate, day)
        })
        
        const dayRevenue = dayDocs.reduce(
          (sum, doc) => sum + invoiceTotalEurForReport(doc as Record<string, unknown>),
          0,
        )
        
        return {
          date: day,
          revenue: dayRevenue,
          formattedDate: format(day, "MMM d")
        }
      })
    } else {
      // Monthly data — full calendar year = 12 months when a year is selected (this / last year)
      let monthRangeStart = startDate
      let monthRangeEnd = endDate
      if (timeframe === "thisYear" || timeframe === "lastYear") {
        const y = getYear(startDate)
        monthRangeStart = new Date(y, 0, 1)
        monthRangeEnd = new Date(y, 11, 31, 23, 59, 59, 999)
      }

      const months = eachMonthOfInterval({ start: monthRangeStart, end: monthRangeEnd })

      data = months.map((month) => {
        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(month)
        
        const monthDocs = revenueDocuments.filter((doc) => {
          const docDate = getRevenueDocumentDate(doc)
          return docDate >= monthStart && docDate <= monthEnd
        })
        
        const monthRevenue = monthDocs.reduce(
          (sum, doc) => sum + invoiceTotalEurForReport(doc as Record<string, unknown>),
          0,
        )
        
        return {
          date: month,
          revenue: monthRevenue,
          formattedDate: format(month, "MMM yyyy")
        }
      })
    }

    setChartData(data)
  }, [documents, timeframe, startDate, endDate, revenueDocumentsForCurrency])

  const maxRevenue = chartData.length ? Math.max(0, ...chartData.map((d) => d.revenue ?? 0)) : 0
  const revenueYTicks = buildRevenueYTicks(maxRevenue)
  const revenueYMax = revenueYTicks[revenueYTicks.length - 1] ?? 1

  if (chartData.length === 0) {
    return (
      <div className="flex h-[350px] w-full min-w-0 max-w-full items-center justify-center overflow-hidden text-muted-foreground">
        No revenue data available for the selected period
      </div>
    )
  }

  return (
    <div className="h-[350px] w-full min-w-0 max-w-full overflow-hidden">
      <ChartContainer
        className="aspect-auto h-full w-full min-h-0 min-w-0 max-w-full [&_.recharts-responsive-container]:!max-w-full"
        config={{
          revenue: {
            label: "Invoice revenue",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <LineChart data={chartData} margin={{ top: 28, right: 24, left: 4, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12 }}
            tickMargin={10}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, revenueYMax]}
            ticks={revenueYTicks}
            tickFormatter={(value) => formatCurrencyAxisCompact(value, DISPLAY_CURRENCY)}
            width={72}
          />
          <ChartTooltip content={(props) => <CustomTooltip {...props} currency={DISPLAY_CURRENCY} />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-revenue)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          >
            <LabelList
              dataKey="revenue"
              position="top"
              offset={10}
              formatter={(value: number | string) =>
                formatCurrencyAxisCompact(Number(value), DISPLAY_CURRENCY)
              }
              style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
          </Line>
        </LineChart>
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
          <div className="text-sm font-medium">{label}</div>
          <div className="text-sm font-semibold text-primary">
            {formatRevenueFull(Number(payload[0].value), currency)}
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
