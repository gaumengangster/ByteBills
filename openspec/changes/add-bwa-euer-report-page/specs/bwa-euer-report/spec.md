## Purpose

Lets signed-in users calculate DATEV BWA 43 (Betriebswirtschaftliche Auswertung für EÜR) for a chosen month, with a last-six-months cumulative, plus annual EÜR hints, and download a PDF of that report.

## ADDED Requirements

### Requirement: Authenticated BWA / EÜR page
The system SHALL provide a dedicated BWA / EÜR page at `/bwa-euer` that is available only to a signed-in user. An unauthenticated visitor MUST be sent to the login flow.

#### Scenario: Signed-in user opens the page
- **GIVEN** a signed-in user
- **WHEN** the user navigates to `/bwa-euer`
- **THEN** the page loads with year and month selectors and the BWA 43 table

#### Scenario: Guest is redirected
- **GIVEN** a visitor who is not signed in
- **WHEN** the visitor requests `/bwa-euer`
- **THEN** the system redirects them to the login page

### Requirement: Month and year period
The system SHALL calculate BWA 43 for one calendar month and the cumulative **last six calendar months** ending in that month (not January year-to-date). Selectors MUST default to the current calendar month and year. The year list MUST include at least the current year and the four preceding years.

#### Scenario: Default period
- **GIVEN** a signed-in user opening `/bwa-euer` in August 2026
- **WHEN** the page finishes loading
- **THEN** the selected period is August 2026
- **AND** the month column is labeled for August 2026
- **AND** the cumulative column is labeled March–August 2026 (last six months)

#### Scenario: Recalculate on period change
- **GIVEN** a signed-in user viewing August 2026
- **WHEN** the user selects March 2025
- **THEN** the month column reflects March 2025 only
- **AND** the cumulative column reflects October 2024–March 2025

### Requirement: BWA 43 table columns
The system SHALL render a table with a designation column and, for both the selected month and the last-six-months cumulative: amount in EUR, % of Summe der Erlöse, % of Summe der Kosten, and % of Betriebseinnahmen. When a percentage base is 0, the cell MUST show an em dash, not a number.

#### Scenario: Percentage of Erlöse
- **GIVEN** March–August Erlöse of €24,393.01 and Personalkosten of €3,450.00
- **WHEN** the user views BWA 43 for August 2026
- **THEN** Personalkosten % Ges.-Erlöse in the last-six-months column is 14.14%

### Requirement: BWA 43 line set
The system SHALL include every DATEV BWA 43 line below, in German labels. Amounts MUST be EUR. Lines with no mapped ByteBills data MUST still appear as 0,00 €.

**Betriebseinnahmen:** Erlöse aus betrieblichen Tätigkeiten; Sonstige Erlöse; Summe der Erlöse; Umsatzsteuer; Umsatzsteuer-Erstattung; Erhaltene Anzahlungen; Zugang Forderungen; Betriebseinnahmen.

**Betriebsausgaben:** Material-/Wareneinkauf; Fremdleistungen; Personalkosten; Raumkosten; Steuern/Versicherung/Beiträge; Fahrzeugkosten; Werbe-/Reisekosten; Kosten Warenabgabe; Instandhaltung/Werkzeuge; EDV-/Büroausstattung, GWG oder Anlagevermögen; Abschreibungen; Verschiedene Kosten; Summe der Kosten; Geleistete Anzahlungen; Buchwert Anlagenabgang; Sonstige Aufwendungen; Vorsteuer; Umsatzsteuer-Zahlung; Verrechnete kalkulatorische Kosten; Zugang Verbindlichkeiten; Betriebsausgaben.

**Ergebnis / Liquidität:** Vorläufiges betriebswirtschaftliches Ergebnis (Gewinn); Weitere Konten; Vorläufiges Ergebnis; Abschreibungen (nicht kalkulatorisch); Aufnahme Darlehen; Tilgung Darlehen; Anlagenzugänge; Anlagenabgänge; Sonstige Posten; Liquiditätsbeiträge Betrieb; Privateinlagen; Grundstücksertrag; Grundstücksaufwand; Privatentnahmen; Unentgeltliche Wertabgaben; Privatsteuern; Sonderausgaben/Spenden; Außergewöhnliche Belastung; Liquiditätsbeiträge Privat; Liquiditätsüberdeckung/-unterdeckung.

Derived amounts MUST satisfy:

- Summe der Erlöse = betriebliche Erlöse + sonstige Erlöse
- Betriebseinnahmen = Summe der Erlöse + Umsatzsteuer + Umsatzsteuer-Erstattung + erhaltene Anzahlungen − Zugang Forderungen
- Summe der Kosten = the twelve Kostenarten
- Betriebsausgaben = Summe der Kosten + Anzahlungen + Buchwert + sonstige Aufwendungen + Vorsteuer + USt-Zahlung + kalkulatorische Kosten + Zugang Verbindlichkeiten
- Gewinn = Betriebseinnahmen − Betriebsausgaben
- Liquiditätsbeiträge Betrieb = Vorläufiges Ergebnis + AfA (nicht kalkulatorisch) + Darlehensaufnahme − Tilgung − Anlagenzugänge + Anlagenabgänge + Sonstige Posten
- Liquiditätsbeiträge Privat = Privateinlagen + Grundstücksertrag − Grundstücksaufwand − Privatentnahmen − unentgeltliche Wertabgaben − Privatsteuern − Sonderausgaben − außergewöhnliche Belastung
- Liquiditätsüberdeckung/-unterdeckung = Liquiditätsbeiträge Betrieb + Liquiditätsbeiträge Privat

#### Scenario: Cash-basis Betriebseinnahmen
- **GIVEN** 2026 invoices with net €24,393.01 of which €6,986.43 is not paid (status not paid and not cancelled)
- **WHEN** the user views January–December 2026 (or a YTD that includes all of them)
- **THEN** Erlöse aus betrieblichen Tätigkeiten is €24,393.01
- **AND** Zugang Forderungen is €6,986.43
- **AND** Betriebseinnahmen is €17,406.58 when USt, Erstattung, and Anzahlungen are 0

#### Scenario: Kosten plus Vorsteuer
- **GIVEN** YTD Kostenarten summing to €4,910.00 and Vorsteuer €58.90, other BA add-ons 0
- **WHEN** the user views that period
- **THEN** Summe der Kosten is €4,910.00
- **AND** Betriebsausgaben is €4,968.90
- **AND** Gewinn equals Betriebseinnahmen minus €4,968.90

#### Scenario: Receipts are not Erlöse
- **GIVEN** a signed-in user with a sales receipt in March 2026 and no invoices that month
- **WHEN** they view BWA for March 2026
- **THEN** Erlöse aus betrieblichen Tätigkeiten for the month is €0.00

#### Scenario: Empty lines still listed
- **GIVEN** a year with no loans, private deposits, or property income
- **WHEN** the user views BWA 43
- **THEN** Aufnahme Darlehen, Privateinlagen, and Grundstücksertrag each show €0.00

### Requirement: Mapping from ByteBills documents
The system SHALL map issued invoices (not cancelled; not receipts) by Leistungsdatum into the month. Net EUR → Erlöse aus betrieblichen Tätigkeiten; output VAT → Umsatzsteuer; unpaid net → Zugang Forderungen. A cancelled invoice MUST NOT increase Erlöse, Umsatzsteuer, Zugang Forderungen, or Betriebseinnahmen, even if it was marked paid. Supplier euerNet costs (not AfA purchase net) map by expense category: home office/rent → Raumkosten; insurance → Steuern/Versicherung/Beiträge; travel → Werbe-/Reisekosten; hardware/furniture → EDV-/Büroausstattung, GWG oder Anlagevermögen; Pendler Pauschale → Fahrzeugkosten; other tagged or untagged costs and remaining Pauschalen → Verschiedene Kosten. AfA for months in the period → Abschreibungen and Abschreibungen (nicht kalkulatorisch). Asset purchases in the period → Anlagenzugänge. Input VAT on Vorsteuer-eligible costs → Vorsteuer. Foreign-currency costs without persisted EUR MUST be omitted. The system MUST NOT apply a live exchange rate. Income-tax, trade-tax, and Solidaritätszuschlag Vorauszahlungen MUST be recorded as a cost category “Tax prepayment (ESt / GewSt / Soli)”, MUST map to Privatsteuern, and MUST NOT increase Kostenarten, Vorsteuer, or EÜR Z.19.

#### Scenario: Invoice income in March
- **GIVEN** one issued invoice with Leistungsdatum 2026-03-15 and net EUR 1,000, status paid
- **WHEN** they view BWA for March 2026
- **THEN** March Erlöse is €1,000.00
- **AND** March Zugang Forderungen is €0.00
- **AND** March–August Erlöse includes that €1,000.00

#### Scenario: Cancelled invoice is omitted from Betriebseinnahmen
- **GIVEN** one invoice with Leistungsdatum 2026-09-10, net EUR 1,500, status cancelled
- **WHEN** the user views BWA for September 2026
- **THEN** September Erlöse, Umsatzsteuer, Zugang Forderungen, and Betriebseinnahmen do not include that invoice

#### Scenario: Cost missing EUR is omitted
- **GIVEN** a 2026 USD supplier invoice with no persisted EUR net
- **WHEN** the user views BWA / EÜR for that period
- **THEN** that document does not increase Kostenarten or EÜR Z.19

#### Scenario: Income-tax Vorauszahlung is Privatsteuern
- **GIVEN** a paid cost of €2,000 on 2026-03-10 with category Tax prepayment (ESt / GewSt / Soli)
- **WHEN** the user views BWA for March 2026
- **THEN** March Privatsteuern is €2,000.00
- **AND** March Kostenarten and EÜR Z.19 do not include that €2,000.00

#### Scenario: Hardware maps to EDV/GWG
- **GIVEN** a supplier cost of €500 net on 2026-03-10 with category hardware
- **WHEN** the user views BWA for March 2026
- **THEN** EDV-/Büroausstattung, GWG oder Anlagevermögen is €500.00
- **AND** Instandhaltung/Werkzeuge does not include that €500.00

### Requirement: Annual EÜR line report
The system SHALL also show an EÜR report for the selected calendar year with Z.9, Z.10, Z.19, Z.20, Z.44/45, Z.52, Z.53, Z.54, and Z.59 using existing year-end helpers. Sales receipts MUST not count as EÜR income. The report MUST state that it is a helper and not a substitute for tax advice.

#### Scenario: Empty year
- **GIVEN** a signed-in user with no invoices, costs, Pauschalen, or assets in 2024
- **WHEN** they view EÜR for 2024
- **THEN** every EÜR amount is €0.00
- **AND** the tax-advice disclaimer is visible

### Requirement: Downloadable BWA 43 PDF
The system SHALL let the user download a PDF named so that it includes `BWA`, `43`, the year, and the month. The PDF MUST be titled Betriebswirtschaftliche Auswertung für EÜR (BWA 43), show company name and email when known, Kurzfristige Erfolgsrechnung for the selected month, print date, both period columns, all BWA 43 lines, German EUR formatting, and the footer that the result is provisional and may change with closing entries.

#### Scenario: Export August 2026
- **GIVEN** a signed-in user viewing August 2026
- **WHEN** the user downloads the report
- **THEN** the filename contains `2026` and `08` (or `August`) and `BWA` and `43`
- **AND** the PDF contains the BWA 43 title, August 2026, March–August 2026, and the disclaimer

### Requirement: Discoverable from the rest of the app
The system SHALL link to `/bwa-euer` from the main navigation, the marketing home feature area, and the dashboard. The analytics reports page MUST offer a link to `/bwa-euer` instead of duplicating the full EÜR table.

#### Scenario: Nav link
- **GIVEN** a signed-in user on any authenticated page with the main nav
- **WHEN** they open the main navigation
- **THEN** a BWA / EÜR item is present and goes to `/bwa-euer`

#### Scenario: Reports defers to the dedicated page
- **GIVEN** a signed-in user on `/reports` with year timeframe “This year”
- **WHEN** the reports page renders
- **THEN** it does not show the full EÜR line table
- **AND** it includes a link to `/bwa-euer`
