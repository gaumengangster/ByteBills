/** DATEV BWA 43 — Betriebswirtschaftliche Auswertung für EÜR. */

export type Bwa43LineId =
  | "erloese_betrieblich"
  | "sonstige_erloese"
  | "summe_erloese"
  | "umsatzsteuer"
  | "umsatzsteuer_erstattung"
  | "erhaltene_anzahlungen"
  | "zugang_forderungen"
  | "betriebseinnahmen"
  | "material"
  | "fremdleistungen"
  | "personalkosten"
  | "raumkosten"
  | "steuern_versicherung"
  | "fahrzeugkosten"
  | "werbe_reisekosten"
  | "kosten_warenabgabe"
  | "instandhaltung"
  | "edv_buero_gwg"
  | "abschreibungen"
  | "verschiedene_kosten"
  | "summe_kosten"
  | "geleistete_anzahlungen"
  | "buchwert_anlagenabgang"
  | "sonstige_aufwendungen"
  | "vorsteuer"
  | "umsatzsteuer_zahlung"
  | "kalkulatorische_kosten"
  | "zugang_verbindlichkeiten"
  | "betriebsausgaben"
  | "gewinn"
  | "weitere_konten"
  | "vorlaeufiges_ergebnis"
  | "afa_nicht_kalkulatorisch"
  | "aufnahme_darlehen"
  | "tilgung_darlehen"
  | "anlagenzugaenge"
  | "anlagenabgaenge"
  | "sonstige_posten"
  | "liquiditaet_betrieb"
  | "privateinlagen"
  | "grundstuecksertrag"
  | "grundstuecksaufwand"
  | "privatentnahmen"
  | "unentgeltliche_wertabgaben"
  | "privatsteuern"
  | "sonderausgaben"
  | "aussergewoehnliche_belastung"
  | "liquiditaet_privat"
  | "liquiditaet_saldo"

export type Bwa43Section = "einnahmen" | "ausgaben" | "ergebnis" | "liquiditaet"
export type Bwa43PercentKind = "erloese" | "kosten" | "betriebseinnahmen" | "none"
export type Bwa43RowKind = "section" | "line" | "total" | "spacer"

export type Bwa43LeafId = Exclude<
  Bwa43LineId,
  | "summe_erloese"
  | "betriebseinnahmen"
  | "summe_kosten"
  | "betriebsausgaben"
  | "gewinn"
  | "vorlaeufiges_ergebnis"
  | "liquiditaet_betrieb"
  | "liquiditaet_privat"
  | "liquiditaet_saldo"
>

export type Bwa43Amounts = Record<Bwa43LineId, number>

export type Bwa43RowDef = {
  id: Bwa43LineId | null
  kind: Bwa43RowKind
  label: string
  section: Bwa43Section
  percentKind: Bwa43PercentKind
  derived: boolean
}

const KOSTENARTEN: Bwa43LeafId[] = [
  "material",
  "fremdleistungen",
  "personalkosten",
  "raumkosten",
  "steuern_versicherung",
  "fahrzeugkosten",
  "werbe_reisekosten",
  "kosten_warenabgabe",
  "instandhaltung",
  "edv_buero_gwg",
  "abschreibungen",
  "verschiedene_kosten",
]

export const BWA43_KOSTENARTEN = KOSTENARTEN

export const BWA43_ROWS: Bwa43RowDef[] = [
  { id: null, kind: "section", label: "Betriebseinnahmen", section: "einnahmen", percentKind: "none", derived: false },
  { id: "erloese_betrieblich", kind: "line", label: "Erlöse aus betrieblichen Tätigkeiten", section: "einnahmen", percentKind: "erloese", derived: false },
  { id: "sonstige_erloese", kind: "line", label: "Sonstige Erlöse", section: "einnahmen", percentKind: "erloese", derived: false },
  { id: "summe_erloese", kind: "total", label: "Summe der Erlöse", section: "einnahmen", percentKind: "erloese", derived: true },
  { id: "umsatzsteuer", kind: "line", label: "Umsatzsteuer", section: "einnahmen", percentKind: "none", derived: false },
  { id: "umsatzsteuer_erstattung", kind: "line", label: "Umsatzsteuer-Erstattung", section: "einnahmen", percentKind: "none", derived: false },
  { id: "erhaltene_anzahlungen", kind: "line", label: "Erhaltene Anzahlungen", section: "einnahmen", percentKind: "none", derived: false },
  { id: "zugang_forderungen", kind: "line", label: "Zugang Forderungen", section: "einnahmen", percentKind: "none", derived: false },
  { id: "betriebseinnahmen", kind: "total", label: "Betriebseinnahmen", section: "einnahmen", percentKind: "betriebseinnahmen", derived: true },
  { id: null, kind: "spacer", label: "", section: "ausgaben", percentKind: "none", derived: false },
  { id: null, kind: "section", label: "Betriebsausgaben", section: "ausgaben", percentKind: "none", derived: false },
  { id: "material", kind: "line", label: "Material-/Wareneinkauf", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "fremdleistungen", kind: "line", label: "Fremdleistungen", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "personalkosten", kind: "line", label: "Personalkosten", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "raumkosten", kind: "line", label: "Raumkosten", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "steuern_versicherung", kind: "line", label: "Steuern/Versicherung/Beiträge", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "fahrzeugkosten", kind: "line", label: "Fahrzeugkosten", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "werbe_reisekosten", kind: "line", label: "Werbe-/Reisekosten", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "kosten_warenabgabe", kind: "line", label: "Kosten Warenabgabe", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "instandhaltung", kind: "line", label: "Instandhaltung/Werkzeuge", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "edv_buero_gwg", kind: "line", label: "EDV-/Büroausstattung, GWG oder Anlagevermögen", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "abschreibungen", kind: "line", label: "Abschreibungen", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "verschiedene_kosten", kind: "line", label: "Verschiedene Kosten", section: "ausgaben", percentKind: "kosten", derived: false },
  { id: "summe_kosten", kind: "total", label: "Summe der Kosten", section: "ausgaben", percentKind: "kosten", derived: true },
  { id: "geleistete_anzahlungen", kind: "line", label: "Geleistete Anzahlungen", section: "ausgaben", percentKind: "none", derived: false },
  { id: "buchwert_anlagenabgang", kind: "line", label: "Buchwert Anlagenabgang", section: "ausgaben", percentKind: "none", derived: false },
  { id: "sonstige_aufwendungen", kind: "line", label: "Sonstige Aufwendungen", section: "ausgaben", percentKind: "none", derived: false },
  { id: "vorsteuer", kind: "line", label: "Vorsteuer", section: "ausgaben", percentKind: "none", derived: false },
  { id: "umsatzsteuer_zahlung", kind: "line", label: "Umsatzsteuer-Zahlung", section: "ausgaben", percentKind: "none", derived: false },
  { id: "kalkulatorische_kosten", kind: "line", label: "Verrechnete kalkulatorische Kosten", section: "ausgaben", percentKind: "none", derived: false },
  { id: "zugang_verbindlichkeiten", kind: "line", label: "Zugang Verbindlichkeiten", section: "ausgaben", percentKind: "none", derived: false },
  { id: "betriebsausgaben", kind: "total", label: "Betriebsausgaben", section: "ausgaben", percentKind: "betriebseinnahmen", derived: true },
  { id: null, kind: "spacer", label: "", section: "ergebnis", percentKind: "none", derived: false },
  { id: "gewinn", kind: "total", label: "Vorläufiges betriebswirtschaftliches Ergebnis (Gewinn)", section: "ergebnis", percentKind: "betriebseinnahmen", derived: true },
  { id: "weitere_konten", kind: "line", label: "Weitere Konten", section: "ergebnis", percentKind: "none", derived: false },
  { id: null, kind: "section", label: "Liquiditätsüberdeckung/-unterdeckung", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "vorlaeufiges_ergebnis", kind: "line", label: "Vorläufiges Ergebnis", section: "liquiditaet", percentKind: "none", derived: true },
  { id: "afa_nicht_kalkulatorisch", kind: "line", label: "Abschreibungen (nicht kalkulatorisch)", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "aufnahme_darlehen", kind: "line", label: "Aufnahme Darlehen", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "tilgung_darlehen", kind: "line", label: "Tilgung Darlehen", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "anlagenzugaenge", kind: "line", label: "Anlagenzugänge", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "anlagenabgaenge", kind: "line", label: "Anlagenabgänge", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "sonstige_posten", kind: "line", label: "Sonstige Posten", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "liquiditaet_betrieb", kind: "total", label: "Liquiditätsbeiträge Betrieb", section: "liquiditaet", percentKind: "none", derived: true },
  { id: "privateinlagen", kind: "line", label: "Privateinlagen", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "grundstuecksertrag", kind: "line", label: "Grundstücksertrag", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "grundstuecksaufwand", kind: "line", label: "Grundstücksaufwand", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "privatentnahmen", kind: "line", label: "Privatentnahmen", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "unentgeltliche_wertabgaben", kind: "line", label: "Unentgeltliche Wertabgaben", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "privatsteuern", kind: "line", label: "Privatsteuern", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "sonderausgaben", kind: "line", label: "Sonderausgaben/Spenden", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "aussergewoehnliche_belastung", kind: "line", label: "Außergewöhnliche Belastung", section: "liquiditaet", percentKind: "none", derived: false },
  { id: "liquiditaet_privat", kind: "total", label: "Liquiditätsbeiträge Privat", section: "liquiditaet", percentKind: "none", derived: true },
  { id: "liquiditaet_saldo", kind: "total", label: "Liquiditätsüberdeckung/-unterdeckung", section: "liquiditaet", percentKind: "none", derived: true },
]

export const BWA43_DISCLAIMER =
  "Das vorläufige Ergebnis entspricht dem derzeitigen Stand der Buchführung. Abschluss-/Abgrenzungsbuchungen können es noch verändern."

export function roundBwaEur(n: number): number {
  return Math.round(n * 100) / 100
}

export function emptyBwa43Leaves(): Record<Bwa43LeafId, number> {
  return {
    erloese_betrieblich: 0,
    sonstige_erloese: 0,
    umsatzsteuer: 0,
    umsatzsteuer_erstattung: 0,
    erhaltene_anzahlungen: 0,
    zugang_forderungen: 0,
    material: 0,
    fremdleistungen: 0,
    personalkosten: 0,
    raumkosten: 0,
    steuern_versicherung: 0,
    fahrzeugkosten: 0,
    werbe_reisekosten: 0,
    kosten_warenabgabe: 0,
    instandhaltung: 0,
    edv_buero_gwg: 0,
    abschreibungen: 0,
    verschiedene_kosten: 0,
    geleistete_anzahlungen: 0,
    buchwert_anlagenabgang: 0,
    sonstige_aufwendungen: 0,
    vorsteuer: 0,
    umsatzsteuer_zahlung: 0,
    kalkulatorische_kosten: 0,
    zugang_verbindlichkeiten: 0,
    weitere_konten: 0,
    afa_nicht_kalkulatorisch: 0,
    aufnahme_darlehen: 0,
    tilgung_darlehen: 0,
    anlagenzugaenge: 0,
    anlagenabgaenge: 0,
    sonstige_posten: 0,
    privateinlagen: 0,
    grundstuecksertrag: 0,
    grundstuecksaufwand: 0,
    privatentnahmen: 0,
    unentgeltliche_wertabgaben: 0,
    privatsteuern: 0,
    sonderausgaben: 0,
    aussergewoehnliche_belastung: 0,
  }
}

export function finalizeBwa43(leaves: Record<Bwa43LeafId, number>): Bwa43Amounts {
  const r = roundBwaEur
  const summeErloese = r(leaves.erloese_betrieblich + leaves.sonstige_erloese)
  const betriebseinnahmen = r(
    summeErloese +
      leaves.umsatzsteuer +
      leaves.umsatzsteuer_erstattung +
      leaves.erhaltene_anzahlungen -
      leaves.zugang_forderungen,
  )
  const summeKosten = r(KOSTENARTEN.reduce((s, id) => s + leaves[id], 0))
  const betriebsausgaben = r(
    summeKosten +
      leaves.geleistete_anzahlungen +
      leaves.buchwert_anlagenabgang +
      leaves.sonstige_aufwendungen +
      leaves.vorsteuer +
      leaves.umsatzsteuer_zahlung +
      leaves.kalkulatorische_kosten +
      leaves.zugang_verbindlichkeiten,
  )
  const gewinn = r(betriebseinnahmen - betriebsausgaben)
  const vorlaeufiges = r(gewinn + leaves.weitere_konten)
  const liqBetrieb = r(
    vorlaeufiges +
      leaves.afa_nicht_kalkulatorisch +
      leaves.aufnahme_darlehen -
      leaves.tilgung_darlehen -
      leaves.anlagenzugaenge +
      leaves.anlagenabgaenge +
      leaves.sonstige_posten,
  )
  const liqPrivat = r(
    leaves.privateinlagen +
      leaves.grundstuecksertrag -
      leaves.grundstuecksaufwand -
      leaves.privatentnahmen -
      leaves.unentgeltliche_wertabgaben -
      leaves.privatsteuern -
      leaves.sonderausgaben -
      leaves.aussergewoehnliche_belastung,
  )
  return {
    ...leaves,
    summe_erloese: summeErloese,
    betriebseinnahmen,
    summe_kosten: summeKosten,
    betriebsausgaben,
    gewinn,
    vorlaeufiges_ergebnis: vorlaeufiges,
    liquiditaet_betrieb: liqBetrieb,
    liquiditaet_privat: liqPrivat,
    liquiditaet_saldo: r(liqBetrieb + liqPrivat),
  }
}

export function bwa43Percent(amount: number, base: number): number | null {
  if (!Number.isFinite(base) || Math.abs(base) < 0.005) return null
  return (amount / base) * 100
}

export function lastDayYmd(year: number, month: number): string {
  const d = new Date(year, month, 0)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function bwa43MonthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0")
  return { from: `${year}-${mm}-01`, to: lastDayYmd(year, month) }
}

/** First day of the month 5 months before `month` through last day of `month` (six months). */
export function bwa43Last6MonthsRange(year: number, month: number): { from: string; to: string } {
  const start = new Date(year, month - 6, 1)
  const sy = start.getFullYear()
  const sm = start.getMonth() + 1
  return {
    from: `${sy}-${String(sm).padStart(2, "0")}-01`,
    to: lastDayYmd(year, month),
  }
}

export function bwa43Last6MonthsStart(year: number, month: number): { year: number; month: number } {
  const start = new Date(year, month - 6, 1)
  return { year: start.getFullYear(), month: start.getMonth() + 1 }
}

export function yearsTouchingRange(range: { from: string; to: string }): number[] {
  const y0 = Number(range.from.slice(0, 4))
  const y1 = Number(range.to.slice(0, 4))
  const out: number[] = []
  for (let y = y0; y <= y1; y++) out.push(y)
  return out
}
