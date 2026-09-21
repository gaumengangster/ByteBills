import jsPDF from "jspdf"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import {
  BWA43_DISCLAIMER,
  BWA43_ROWS,
  bwa43Percent,
  type Bwa43Amounts,
  type Bwa43PercentKind,
} from "@/lib/bwa-43-model"
import type { BwaCompanyHeader } from "@/lib/bwa-euer-year-load"
import { registerFonts } from "@/lib/pdf-fonts"

function formatEurDe(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatPctDe(p: number | null): string {
  if (p == null) return "—"
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p)} %`
}

function percents(amount: number, kind: Bwa43PercentKind, a: Bwa43Amounts): [number | null, number | null, number | null] {
  const e = bwa43Percent(amount, a.summe_erloese)
  const k = bwa43Percent(amount, a.summe_kosten)
  const b = bwa43Percent(amount, a.betriebseinnahmen)
  if (kind === "erloese") return [e, null, null]
  if (kind === "kosten") return [e, k, null]
  if (kind === "betriebseinnahmen") return [null, null, b]
  return [null, null, null]
}

export async function generateBwa43Pdf(params: {
  year: number
  month: number
  monthAmounts: Bwa43Amounts
  last6Amounts: Bwa43Amounts
  company: BwaCompanyHeader
  printedAt?: Date
}): Promise<Blob> {
  const { year, month, monthAmounts, last6Amounts, company } = params
  const printedAt = params.printedAt ?? new Date()
  const monthDate = new Date(year, month - 1, 1)
  const startDate = new Date(year, month - 6, 1)
  const monthLabel = format(monthDate, "LLLL yyyy", { locale: de })
  const last6Label =
    startDate.getFullYear() === monthDate.getFullYear()
      ? `${format(startDate, "LLLL", { locale: de })} - ${format(monthDate, "LLLL yyyy", { locale: de })}`
      : `${format(startDate, "LLLL yyyy", { locale: de })} - ${format(monthDate, "LLLL yyyy", { locale: de })}`

  const pdf = new jsPDF("p", "mm", "a4")
  await registerFonts(pdf)
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const mL = 10
  const mR = 10
  const inner = pageW - mL - mR

  const colLabel = 52
  const colAmt = 22
  const colPct = 12
  const block = colAmt + colPct * 3

  let page = 1

  const drawHeader = () => {
    pdf.setFont("Roboto", "normal")
    pdf.setFontSize(8)
    pdf.text(company.email || "", mL, 10)
    pdf.text(`Kurzfristige Erfolgsrechnung ${monthLabel}`, mL + inner / 2, 10, { align: "center" })
    pdf.text(format(printedAt, "dd.MM.yyyy"), pageW - mR, 10, { align: "right" })
    pdf.setFont("Roboto", "bold")
    pdf.setFontSize(9)
    pdf.text(company.name ? `GF: ${company.name}` : "", mL, 15)
    pdf.text("Betriebswirtschaftliche Auswertung für EÜR (BWA 43)", mL + inner / 2, 15, { align: "center" })
    pdf.setFont("Roboto", "normal")
    pdf.setFontSize(8)
    pdf.text(`Seite: ${page}`, pageW - mR, 15, { align: "right" })
  }

  const drawColHeads = (y: number) => {
    pdf.setFont("Roboto", "bold")
    pdf.setFontSize(6.5)
    const x0 = mL
    const xMonth = x0 + colLabel
    const xYtd = xMonth + block
    pdf.text("Bezeichnung", x0, y)
    pdf.text(monthLabel, xMonth + block - 2, y, { align: "right" })
    pdf.text(last6Label, xYtd + block - 2, y, { align: "right" })
    y += 3.2
    pdf.setFont("Roboto", "normal")
    pdf.setFontSize(5.5)
    const sub = (x: number) => {
      pdf.text("% Ges.-Erlöse", x + colAmt + colPct, y, { align: "right" })
      pdf.text("% Ges.-Kosten", x + colAmt + colPct * 2, y, { align: "right" })
      pdf.text("% Betr.-Einnahm.", x + colAmt + colPct * 3, y, { align: "right" })
    }
    sub(xMonth)
    sub(xYtd)
    return y + 2
  }

  const drawFooter = () => {
    pdf.setFont("Roboto", "normal")
    pdf.setFontSize(6)
    pdf.text(BWA43_DISCLAIMER, mL, pageH - 8, { maxWidth: inner })
  }

  const amountBlock = (x: number, y: number, amount: number, kind: Bwa43PercentKind, a: Bwa43Amounts, bold: boolean) => {
    const [pe, pk, pb] = percents(amount, kind, a)
    pdf.setFont("Roboto", bold ? "bold" : "normal")
    pdf.setFontSize(6.5)
    pdf.text(formatEurDe(amount), x + colAmt, y, { align: "right" })
    pdf.setFont("Roboto", "normal")
    pdf.setFontSize(5.5)
    pdf.text(formatPctDe(pe), x + colAmt + colPct, y, { align: "right" })
    pdf.text(formatPctDe(pk), x + colAmt + colPct * 2, y, { align: "right" })
    pdf.text(formatPctDe(pb), x + colAmt + colPct * 3, y, { align: "right" })
  }

  drawHeader()
  let y = drawColHeads(20)
  const xMonth = mL + colLabel
  const xYtd = xMonth + block

  const newPage = () => {
    drawFooter()
    pdf.addPage()
    page += 1
    drawHeader()
    y = drawColHeads(20)
  }

  for (const row of BWA43_ROWS) {
    if (y > pageH - 18) newPage()

    if (row.kind === "spacer") {
      y += 3
      continue
    }

    if (row.kind === "section") {
      pdf.setFont("Roboto", "bold")
      pdf.setFontSize(8)
      pdf.text(row.label, mL, y)
      y += 4.2
      continue
    }

    if (!row.id) continue
    const monthAmt = monthAmounts[row.id]
    const last6Amt = last6Amounts[row.id]
    const bold = row.kind === "total"

    if (bold) {
      pdf.setDrawColor(180)
      pdf.setLineWidth(0.15)
      pdf.line(mL, y - 3.2, pageW - mR, y - 3.2)
    }

    pdf.setFont("Roboto", bold ? "bold" : "normal")
    pdf.setFontSize(6.5)
    const labelLines = pdf.splitTextToSize(row.label, colLabel - 1) as string[]
    pdf.text(labelLines[0] ?? row.label, mL, y)
    amountBlock(xMonth, y, monthAmt, row.percentKind, monthAmounts, bold)
    amountBlock(xYtd, y, last6Amt, row.percentKind, last6Amounts, bold)
    y += labelLines.length > 1 ? 3.6 : 3.6
    if (labelLines.length > 1) {
      pdf.setFont("Roboto", bold ? "bold" : "normal")
      pdf.setFontSize(6.5)
      pdf.text(labelLines.slice(1), mL, y - 1.2)
      y += 2.2 * (labelLines.length - 1)
    }
  }

  drawFooter()
  return pdf.output("blob")
}

export function bwa43PdfFilename(year: number, month: number): string {
  const mm = String(month).padStart(2, "0")
  return `BWA-Betriebswirtschaftliche_Auswertung_fuer_EUR_BWA_43-${year}-${mm}.pdf`
}
