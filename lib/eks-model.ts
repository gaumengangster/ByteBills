/** Jobcenter-EKS 04/2026 — Tables A, B (parts 1–3), C. */

export type EksLineId =
  | "a1"
  | "a2"
  | "a3"
  | "a4"
  | "a5_1"
  | "a5_2"
  | "a5_3"
  | "a_sum"
  | "b1"
  | "b2_1"
  | "b2_2"
  | "b2_3"
  | "b2_4"
  | "b3"
  | "b4"
  | "b5"
  | "b1_sub"
  | "b2_carry"
  | "b6_1"
  | "b6_2"
  | "b6_3"
  | "b6_4"
  | "b6_priv_km"
  | "b6_5"
  | "b7_1"
  | "b7_2"
  | "b7_3"
  | "b8"
  | "b9"
  | "b10"
  | "b2_sub"
  | "b3_carry"
  | "b11"
  | "b12"
  | "b13"
  | "b14_1"
  | "b14_2"
  | "b14_3"
  | "b14_4"
  | "b14_5"
  | "b15"
  | "b16"
  | "b17"
  | "b18"
  | "b_sum"
  | "gewinn"

export type EksLeafId = Exclude<
  EksLineId,
  "a_sum" | "b1_sub" | "b2_carry" | "b2_sub" | "b3_carry" | "b_sum" | "gewinn"
>

export type EksSection = "a" | "b1" | "b2" | "b3"
export type EksRowKind = "leaf" | "carry" | "total"

export type EksAmounts = Record<EksLineId, number>

export type EksRowDef = {
  id: EksLineId
  label: string
  section: EksSection
  kind: EksRowKind
}

export const EKS_A_ROWS: EksRowDef[] = [
  { id: "a1", label: "A1 Betriebseinnahmen", section: "a", kind: "leaf" },
  { id: "a2", label: "A2 Privatentnahmen von Waren", section: "a", kind: "leaf" },
  { id: "a3", label: "A3 sonstige betriebliche Einnahmen", section: "a", kind: "leaf" },
  { id: "a4", label: "A4 Zuwendungen von Dritten", section: "a", kind: "leaf" },
  { id: "a5_1", label: "A5.1 vereinnahmte Umsatzsteuer", section: "a", kind: "leaf" },
  { id: "a5_2", label: "A5.2 Umsatzsteuer auf Privatentnahmen von Waren", section: "a", kind: "leaf" },
  { id: "a5_3", label: "A5.3 vom Finanzamt erstattete Umsatzsteuer", section: "a", kind: "leaf" },
  { id: "a_sum", label: "Summe der Betriebseinnahmen", section: "a", kind: "total" },
]

export const EKS_B1_ROWS: EksRowDef[] = [
  { id: "b1", label: "B1 Wareneinkauf", section: "b1", kind: "leaf" },
  { id: "b2_1", label: "B2.1 Personalkosten – Vollzeitbeschäftigte", section: "b1", kind: "leaf" },
  { id: "b2_2", label: "B2.2 Personalkosten – Teilzeitbeschäftigte", section: "b1", kind: "leaf" },
  { id: "b2_3", label: "B2.3 Personalkosten – geringfügig Beschäftigte", section: "b1", kind: "leaf" },
  { id: "b2_4", label: "B2.4 Personalkosten – mithelfende Familienangehörige", section: "b1", kind: "leaf" },
  { id: "b3", label: "B3 Betriebliche Raumkosten (einschließlich Nebenkosten und Energiekosten)", section: "b1", kind: "leaf" },
  { id: "b4", label: "B4 Betriebliche Versicherungen/Beiträge", section: "b1", kind: "leaf" },
  { id: "b5", label: "B5 Kosten für Werbung", section: "b1", kind: "leaf" },
  { id: "b1_sub", label: "Zwischensumme Tabelle B – Teil 1", section: "b1", kind: "total" },
]

export const EKS_B2_ROWS: EksRowDef[] = [
  { id: "b2_carry", label: "Übertrag Zwischensumme Tabelle B – Teil 1", section: "b2", kind: "carry" },
  { id: "b6_1", label: "B6.1 betriebliches Kraftfahrzeug – Steuern", section: "b2", kind: "leaf" },
  { id: "b6_2", label: "B6.2 betriebliches Kraftfahrzeug – Versicherung", section: "b2", kind: "leaf" },
  { id: "b6_3", label: "B6.3 betriebliches Kraftfahrzeug – laufende Betriebskosten", section: "b2", kind: "leaf" },
  { id: "b6_4", label: "B6.4 betriebliches Kraftfahrzeug – Reparaturkosten", section: "b2", kind: "leaf" },
  { id: "b6_priv_km", label: "Abzüglich privat gefahrener Kilometer (0,10 Euro je km)", section: "b2", kind: "leaf" },
  { id: "b6_5", label: "B6.5 privates Kraftfahrzeug – betriebliche Fahrten (0,10 Euro je km)", section: "b2", kind: "leaf" },
  { id: "b7_1", label: "B7.1 Reisekosten – Übernachtungskosten", section: "b2", kind: "leaf" },
  { id: "b7_2", label: "B7.2 Reisekosten – Reisenebenkosten", section: "b2", kind: "leaf" },
  { id: "b7_3", label: "B7.3 Reisekosten – Kosten für öffentliche Verkehrsmittel", section: "b2", kind: "leaf" },
  { id: "b8", label: "B8 Investitionen", section: "b2", kind: "leaf" },
  { id: "b9", label: "B9 Investitionen aus Zuwendungen Dritter", section: "b2", kind: "leaf" },
  { id: "b10", label: "B10 Büromaterial einschließlich Porto", section: "b2", kind: "leaf" },
  { id: "b2_sub", label: "Zwischensumme Tabelle B – Teil 2", section: "b2", kind: "total" },
]

export const EKS_B3_ROWS: EksRowDef[] = [
  { id: "b3_carry", label: "Übertrag Zwischensumme Tabelle B – Teil 2", section: "b3", kind: "carry" },
  { id: "b11", label: "B11 Telefonkosten", section: "b3", kind: "leaf" },
  { id: "b12", label: "B12 Beratungskosten", section: "b3", kind: "leaf" },
  { id: "b13", label: "B13 Fortbildungskosten", section: "b3", kind: "leaf" },
  { id: "b14_1", label: "B14.1 Sonstige Betriebsausgaben – Reparaturkosten Anlagevermögen", section: "b3", kind: "leaf" },
  { id: "b14_2", label: "B14.2 Sonstige Betriebsausgaben – Miete Einrichtung", section: "b3", kind: "leaf" },
  { id: "b14_3", label: "B14.3 Sonstige Betriebsausgaben – Nebenkosten des Geldverkehrs", section: "b3", kind: "leaf" },
  { id: "b14_4", label: "B14.4 Sonstige Betriebsausgaben – Betriebliche Abfallbeseitigung", section: "b3", kind: "leaf" },
  { id: "b14_5", label: "B14.5 weitere bisher nicht erfasste Betriebsausgaben", section: "b3", kind: "leaf" },
  { id: "b15", label: "B15 Schuldzinsen aus Anlagevermögen", section: "b3", kind: "leaf" },
  { id: "b16", label: "B16 Tilgung bestehender betrieblicher Darlehen", section: "b3", kind: "leaf" },
  { id: "b17", label: "B17 gezahlte Vorsteuer", section: "b3", kind: "leaf" },
  { id: "b18", label: "B18 an das Finanzamt gezahlte Umsatzsteuer", section: "b3", kind: "leaf" },
  { id: "b_sum", label: "Summe Betriebsausgaben (Tabelle B Teil 1, 2 und 3)", section: "b3", kind: "total" },
  { id: "gewinn", label: "Gewinn (Betriebseinnahmen abzüglich Betriebsausgaben)", section: "b3", kind: "total" },
]

export type EksCRowId =
  | "c_est"
  | "c_pflicht_kv"
  | "c_private_kv"
  | "c_rente"
  | "c_leben"
  | "c_versorgung"
  | "c_kfz_haft"
  | "c_pflicht_sonst"
  | "c_riester"
  | "c_sonstige"

export type EksCRowDef = {
  id: EksCRowId
  label: string
}

export const EKS_C_ROWS: EksCRowDef[] = [
  {
    id: "c_est",
    label:
      "Einkommensteuervorauszahlungen/Einkommensteuernachzahlungen (siehe letzten Vorauszahlungsbescheid/Einkommensteuerbescheid)",
  },
  {
    id: "c_pflicht_kv",
    label: "Pflichtbeiträge zur Kranken-/Pflege- und/oder Rentenversicherung",
  },
  {
    id: "c_private_kv",
    label:
      "Beiträge zur privaten Kranken- und Pflegeversicherung oder freiwillige Beiträge zur gesetzlichen Kranken- und Pflegeversicherung",
  },
  { id: "c_rente", label: "Beiträge zur Rentenversicherung" },
  { id: "c_leben", label: "Beiträge zu einer kapitalbildenden Lebensversicherung" },
  { id: "c_versorgung", label: "Beiträge zu einer Versorgungseinrichtung" },
  {
    id: "c_kfz_haft",
    label: "Beiträge für eine Kraftfahrzeug-Haftpflichtversicherung (ohne Teil-/Vollkasko/Kraftfahrzeug-Schutzbrief)",
  },
  {
    id: "c_pflicht_sonst",
    label: "Beiträge für weitere gesetzlich vorgeschriebene Versicherungen",
  },
  {
    id: "c_riester",
    label: "Beiträge für eine geförderte Altersvorsorge nach § 82 Einkommensteuergesetz (Riester-Rente)",
  },
  { id: "c_sonstige", label: "Sonstige Absetzungsmöglichkeiten" },
]

export type EksCAmounts = Record<EksCRowId, { amount: number; rhythm: string }>

export function roundEksEur(n: number): number {
  return Math.round(n * 100) / 100
}

export function emptyEksLeaves(): Record<EksLeafId, number> {
  return {
    a1: 0,
    a2: 0,
    a3: 0,
    a4: 0,
    a5_1: 0,
    a5_2: 0,
    a5_3: 0,
    b1: 0,
    b2_1: 0,
    b2_2: 0,
    b2_3: 0,
    b2_4: 0,
    b3: 0,
    b4: 0,
    b5: 0,
    b6_1: 0,
    b6_2: 0,
    b6_3: 0,
    b6_4: 0,
    b6_priv_km: 0,
    b6_5: 0,
    b7_1: 0,
    b7_2: 0,
    b7_3: 0,
    b8: 0,
    b9: 0,
    b10: 0,
    b11: 0,
    b12: 0,
    b13: 0,
    b14_1: 0,
    b14_2: 0,
    b14_3: 0,
    b14_4: 0,
    b14_5: 0,
    b15: 0,
    b16: 0,
    b17: 0,
    b18: 0,
  }
}

export function emptyEksCAmounts(): EksCAmounts {
  const out = {} as EksCAmounts
  for (const row of EKS_C_ROWS) {
    out[row.id] = { amount: 0, rhythm: "" }
  }
  return out
}

export function finalizeEks(leaves: Record<EksLeafId, number>): EksAmounts {
  const r = roundEksEur
  const aSum = r(
    leaves.a1 + leaves.a2 + leaves.a3 + leaves.a4 + leaves.a5_1 + leaves.a5_2 + leaves.a5_3,
  )
  const b1Sub = r(
    leaves.b1 + leaves.b2_1 + leaves.b2_2 + leaves.b2_3 + leaves.b2_4 + leaves.b3 + leaves.b4 + leaves.b5,
  )
  const b2Sub = r(
    b1Sub +
      leaves.b6_1 +
      leaves.b6_2 +
      leaves.b6_3 +
      leaves.b6_4 -
      leaves.b6_priv_km +
      leaves.b6_5 +
      leaves.b7_1 +
      leaves.b7_2 +
      leaves.b7_3 +
      leaves.b8 +
      leaves.b9 +
      leaves.b10,
  )
  const bSum = r(
    b2Sub +
      leaves.b11 +
      leaves.b12 +
      leaves.b13 +
      leaves.b14_1 +
      leaves.b14_2 +
      leaves.b14_3 +
      leaves.b14_4 +
      leaves.b14_5 +
      leaves.b15 +
      leaves.b16 +
      leaves.b17 +
      leaves.b18,
  )
  return {
    ...leaves,
    a_sum: aSum,
    b1_sub: b1Sub,
    b2_carry: b1Sub,
    b2_sub: b2Sub,
    b3_carry: b2Sub,
    b_sum: bSum,
    gewinn: r(aSum - bSum),
  }
}

export type EksYearMonth = { year: number; month: number }

export function eksYmKey(ym: EksYearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`
}

/** Six calendar months ending in `endMonth` of `endYear` (inclusive). */
export function eksSixMonthsEnding(endYear: number, endMonth: number): EksYearMonth[] {
  const start = new Date(endYear, endMonth - 6, 1)
  const out: EksYearMonth[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return out
}

export function eksMonthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0")
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` }
}

export const EKS_DISCLAIMER =
  "Diese Seite ist eine Ausfüllhilfe für die Jobcenter-EKS (Erklärung zum Einkommen aus selbständiger Tätigkeit). Sie ersetzt keine Steuerberatung und keine Entscheidung des Jobcenters / SGB II."
