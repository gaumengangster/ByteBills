## Why

ByteBills already computes German EÜR line hints, but they are buried on `/reports` and only appear for “This year” / “Last year”. Freelancers (and their Steuerberater) use DATEV **BWA 43 — Betriebswirtschaftliche Auswertung für EÜR**: a month column plus January–month cumulative, with the full Einnahmen / Ausgaben / Liquidität line set. ByteBills needs to calculate that from invoices and costs and produce a matching PDF.

## What Changes

- Add an authenticated **BWA / EÜR** page (`/bwa-euer`) with **year + month** selectors (default: current month).
- **BWA 43 table** matching the DATEV layout: selected month | % Ges.-Erlöse | % Ges.-Kosten | % Betr.-Einnahm. | January–month cumulative | the same three %.
- **All BWA 43 lines** (Betriebseinnahmen, Betriebsausgaben, vorläufiges Ergebnis, Liquidität Betrieb/Privat), including rows ByteBills cannot yet source (shown as 0,00 €).
- **EÜR tab**: existing annual Anlage EÜR hints for the selected calendar year.
- **PDF** titled *Betriebswirtschaftliche Auswertung für EÜR (BWA 43)*, two pages, German number format, company header, bookkeeping disclaimer.
- Nav, dashboard, and home link to the page; `/reports` links here instead of duplicating the full EÜR table.

Assumptions:

- Sales receipts stay out of Erlöse / EÜR income.
- Persisted EUR only (no live FX).
- Unpaid invoices (`status` not `paid`/`cancelled`) map to **Zugang Forderungen** so Betriebseinnahmen ≈ cash (Erlöse − Forderungen).
- Cost categories map onto DATEV Kostenarten; untagged costs go to **Verschiedene Kosten**. Lines with no ByteBills source stay 0,00 €.

## Capabilities

### New Capabilities

- `bwa-euer-report`: DATEV BWA 43 (month + YTD, full line set) plus annual EÜR hints, on-screen and as PDF.

### Modified Capabilities

- None.

## Impact

- New route `app/bwa-euer/`, `lib/bwa-43-*.ts`, PDF via existing `jspdf`.
- Reuse invoice/cost/pauschal/AfA fetchers and `aggregateEurAnnualSummary`.
- Touch navbar, home, dashboard, reports.
