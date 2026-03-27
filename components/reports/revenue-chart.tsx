"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, TooltipProps, LabelList } from "recharts"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay } from "date-fns"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  buildRevenueYTicks,
  formatCurrencyAxisCompact,
  formatRevenueFull,
} from "@/lib/format-chart-axis"
import { getRevenueDocumentDate } from "@/lib/revenue-document-date"
import {
  convertAmountToEur,
  mergeEcbLiveRates,
  type EurRatesByDocumentDate,
  type EurReferenceRates,
} from "@/lib/eur-rates"

const DISPLAY_CURRENCY = "EUR"

type RevenueChartProps = {
  documents: any[]
  timeframe: string
  startDate: Date
  endDate: Date
  /** ECB rates per invoice/receipt calendar date (yyyy-MM-dd). */
  eurRatesByDocDate?: EurRatesByDocumentDate
}

export function RevenueChart({ documents, timeframe, startDate, endDate, eurRatesByDocDate }: RevenueChartProps) {
  const [chartData, setChartData] = useState<any[]>([])

  const revenueDocumentsForCurrency = useMemo(() => {
    return documents.filter((doc) => {
      if ((doc.type !== "invoices" && doc.type !== "receipts") || !doc.total) {
        return false
      }
      const d = getRevenueDocumentDate(doc)
      return !Number.isNaN(d.getTime())
    })
  }, [documents])

  const ratesForDoc = (doc: (typeof documents)[0]): EurReferenceRates => {
    const d = getRevenueDocumentDate(doc)
    if (Number.isNaN(d.getTime())) {
      return mergeEcbLiveRates({})
    }
    const key = format(d, "yyyy-MM-dd")
    return eurRatesByDocDate?.[key] ?? mergeEcbLiveRates({})
  }

  useEffect(() => {
    if (!documents.length) {
      setChartData([])
      return
    }

    // Invoices: group by invoiceDate. Receipts: group by receiptDate (no createdAt fallback).
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
          (sum, doc) => sum + convertAmountToEur(doc.total, doc.currency, ratesForDoc(doc)),
          0,
        )
        
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
        
        const monthDocs = revenueDocuments.filter((doc) => {
          const docDate = getRevenueDocumentDate(doc)
          return docDate >= monthStart && docDate <= monthEnd
        })
        
        const monthRevenue = monthDocs.reduce(
          (sum, doc) => sum + convertAmountToEur(doc.total, doc.currency, ratesForDoc(doc)),
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
  }, [documents, timeframe, startDate, endDate, revenueDocumentsForCurrency, eurRatesByDocDate])

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
            label: "Revenue",
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
