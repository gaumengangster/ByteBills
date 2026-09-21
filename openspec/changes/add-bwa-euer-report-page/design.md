## Context

See `proposal.md`. Reference PDF: DATEV *BWA 43 — Betriebswirtschaftliche Auswertung für EÜR* (Kurzfristige Erfolgsrechnung): month + January–month, German labels, % of Erlöse / Kosten / Betriebseinnahmen, two pages, provisional-result footer. Specs: `specs/bwa-euer-report/spec.md`.

Existing annual EÜR helpers stay for the EÜR tab. Invoice period = `taxDate`. Costs = `euerYear` + `expenseDate`. EUR = persisted / BMF enrich only.

## Goals / Non-Goals

**Goals:**

- Reproduce the BWA 43 **line list and column layout** (not DATEV SKR account numbers).
- Derive totals with the same arithmetic as the sample PDF (Erlöse − Forderungen = Betriebseinnahmen when USt/Anzahlungen are 0; Kosten + Vorsteuer = Betriebsausgaben when other add-ons are 0).
- PDF a Steuerberater can recognize as BWA 43.

**Non-Goals:**

- DATEV export, SKR03/04 posting, ELSTER XML, loans/private-ledger bookkeeping (those lines stay 0 until data exists).
- New Firestore fields for BWA cost kinds (map today’s `euerExpenseCategory` / pauschale type).
- Live FX.

## Decisions

### 1. Period is month + last 6 months

Match DATEV two-column layout, but the cumulative column is the **last six calendar months** ending in the selected month (e.g. August 2026 → März–August 2026). Year + month `<Select>`. Load invoices/costs for every calendar year the window touches.

### 2. Single aggregator for a closed date range

`aggregateBwa43ForRange(docs, { from, to })` returns leaf amounts; `finalizeBwa43(leaves)` applies the identities. The page calls it twice (month range, last-6-months range).

**Zugang Forderungen:** net EUR of invoices in range with `status` not `paid` and not `cancelled`.

**Kostenarten mapping:** homeoffice_miete → Raumkosten; insurance → Steuern/Versicherung/Beiträge; travel → Werbe-/Reisekosten; hardware/furniture → Instandhaltung/Werkzeuge; Pendler pauschale → Fahrzeugkosten; else including untagged → Verschiedene Kosten. AfA purchase net excluded from Kostenarten; monthly AfA → Abschreibungen.

**Pauschale:** same annual amount as EÜR extras, split equally across overlapping months of the calendar year, then summed for the range.

**AfA:** existing monthly linear helper per calendar month; yearly slices spread across 12 months of `_sliceYear`. `Abschreibungen (nicht kalkulatorisch)` copies Abschreibungen (add-back). Asset purchase net in range → Anlagenzugänge.

### 3. UI + PDF share the row model

`lib/bwa-43-model.ts` lists every line (id, German label, section, percent kind, derived vs leaf). Table and PDF iterate that list. German labels on screen and PDF (official form). Page chrome EN.

PDF: A4 portrait, Roboto, two pages if needed, `de-DE` currency, filename `BWA-Betriebswirtschaftliche_Auswertung_fuer_EUR_BWA_43-{yyyy}-{MM}.pdf`. Header: company name, email, “Kurzfristige Erfolgsrechnung {Monat JJJJ}”, print date, title, page n. Footer: *Das vorläufige Ergebnis entspricht dem derzeitigen Stand der Buchführung…*

### 4. Loader

`lib/bwa-euer-year-load.ts` loads the calendar year (invoice window + `revenueInvoiceMatchesCalendarYear`, `fetchBillsForEuerYear`, vat bills, pauschal, assets, BMF enrich, default company from `bytebills-users`). EÜR via `aggregateEurAnnualSummary` for the year. BWA via two range aggregates.

### 5. Reports cleanup

Remove full EÜR table; link card to `/bwa-euer`. Keep ELSTER.

## Risks / Trade-offs

- **[Risk] Cost kinds are coarser than DATEV** → Mitigation: show every line; unmapped → Verschiedene Kosten; unused kinds stay 0.
- **[Risk] Ist vs Soll** → Mitigation: document Zugang Forderungen as unpaid invoices; costs follow EÜR (`euerYear`), not payment status.
- **[Risk] Pauschale month split is approximate** → Mitigation: months sum to the annual EÜR pauschale amount.
- **[Trade-off]** German BWA labels in an otherwise English UI — correct for the official form.

## Migration Plan

Frontend-only. Rollback by reverting the route and links.

## Open Questions

None for v1 (private/loan lines remain 0 until those documents exist).
