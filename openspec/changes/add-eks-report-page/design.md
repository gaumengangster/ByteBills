## Context

See `proposal.md`. Specs: `specs/eks-report/spec.md`.

ByteBills already loads a reporting window in `lib/bwa-euer-year-load.ts` and buckets invoices (`taxDate`) and costs (`expenseDate`) by month for BWA 43. EKS needs a **different line list** (Jobcenter-EKS A/B/C), **six month columns**, and **cash-basis dates**: invoice `paymentDate` and cost `paymentDate`. Issued invoices currently have `invoiceDate`, `dueDate`, and `taxDate` only — no payment date. Costs already allow `paymentDate` on the schema, but the add-cost wizard does not write it.

BWA / EÜR / ELSTER MUST keep Leistungsdatum / expense date. Official form: Jobcenter-EKS 04/2026. No new collections.

## Goals / Non-Goals

**Goals:**

- Reproduce the EKS **line list and six-month grid** so amounts can be copied onto the paper form.
- Cash-basis: count money in the month it was **paid**, using `paymentDate`.
- Persist invoice `paymentDate`; write cost `paymentDate` when marking costs paid.
- Derive Zwischensumme, Übertrag, Summe, and Gewinn with the form’s arithmetic.

**Non-Goals:**

- PDF export (on-screen copy-out only).
- Persisting an EKS submission or declaration type.
- Cost-wizard shortcuts for rent / personal KV.
- Splitting travel into B7.1 vs B7.3, or capturing vehicle kilometers.
- Pages 1–3 and 8–9 of the booklet (identity, signature).
- Changing BWA / EÜR / ELSTER to payment dates.
- Backfilling payment dates for historical paid invoices (user fills them; optional default when marking paid from now on).

## Decisions

### 1. Window is six months ending in a selected month

Year + end-month `<Select>`, default current month (August 2026 → März–August). Same last-6-months helper BWA already uses for its cumulative column, but EKS **expands** that window into six columns rather than one sum.

**Alternative considered:** Fixed March–August 2026 with no selector. Rejected: the Bewilligungszeitraum will move; selectors are cheap if the aggregator is month-keyed.

### 2. One month aggregator, then derive totals

`aggregateEksForMonth(docs, { from, to })` returns leaf amounts for one calendar month. The page calls it six times. `finalizeEks(leaves, tableASumme)` applies identities (Teil 1/2/3 subtotals, Übertrag copies, Gewinn).

**Alternative considered:** One function returning `Record<Ym, amounts>`. Either shape is fine; month-range reuse of BWA’s `{ from, to }` keeps date filtering consistent.

Shared row model (`lib/eks-model.ts`): id, German label, table section, `kind: leaf | carry | total`. Tables iterate that list. Page chrome can stay English; official line labels stay German.

### 3. Category map is EKS-specific, not BWA 43

Do not reuse `bwaCostLineFromCategory` as-is. BWA dumps most leftovers into Verschiedene Kosten and maps hardware to Instandhaltung; EKS has B14.5 for leftovers, B8 for asset **purchases**, B11 for internet, B10 for office supplies.

Tax prepayments stay out of Table B (already excluded from BWA Kostenarten as Privatsteuern) and land on Table C.

Partial business use: use deductible EUR, same as BWA/EÜR.

Pauschale: split across overlapping months as BWA does; mileage → B6.5; home-office pauschale → B3; telephone flat → B11.

**Blank zeros:** leaf 0 → empty cell; calculated rows always show a formatted number (including 0,00 if the total is 0).

### 4. Cash-basis EKS vs Soll BWA

EKS month = calendar month of `paymentDate`. Missing payment date → omit. Cancelled invoices omitted. Partial invoice payments are not modeled: the full net/VAT counts on the single `paymentDate` when status is paid.

Costs: use `paymentDate` (wizard/default: today or expense date when status is paid). `cost_afa` purchases use the asset’s payment date for B8.

Pauschale is not a bank payment → keep BWA-style split across overlapping period months.

**Do not** change `revenueInvoiceReportingYmd` / BWA aggregators.

**Loader:** `loadBwaEuerPeriod` filters by `invoiceDate` / `euerYear`, which misses “invoiced last year, paid this month”. EKS MUST load a lookback window (at least 12 months before the six-month start by invoice/expense date) then filter client-side by `paymentDate`, or query `paymentDate` directly if an index exists. Cross-year payments are in scope.

### 5. Invoice `paymentDate` UX

- Create + edit forms: optional date field next to due date (Berlin `yyyy-MM-dd`, same helper as other document dates).
- Mark as paid: if `paymentDate` empty, set today (allow override in the same action if cheap; otherwise today then edit).
- Detail + list: show payment date when present.
- Cost wizard: when payment status is paid, persist `paymentDate` (default expense date).

### 6. UI extras (declaration + Table C)

Declaration type is React state. Table C is period-level (three columns), not six month columns, still summed by payment date.

### 7. Navigation

Add `{ name: "EKS", href: "/eks" }` next to BWA / EÜR. Also link from dashboard and home feature area where BWA already appears, so the page is discoverable the same way.

## Risks / Trade-offs

- **[Risk] EKS lines are finer than ByteBills categories** → Mitigation: map what exists; leave the rest blank; put leftovers in B14.5; document the map in the spec.
- **[Risk] Jobcenter may treat some costs differently than EÜR** (e.g. which rent share is “betrieblich”) → Mitigation: disclaimer; use the same deductible amounts already used for EÜR.
- **[Trade-off]** Extra Summe column is not on the paper form → Mitigation: labeled Summe so it is not confused with a seventh month.
- **[Risk] Paid invoices without paymentDate vanish from EKS** → Mitigation: set payment date when marking paid; show payment date on invoice detail; page can note that unpaid / undated items are excluded.
- **[Risk] BWA year loader misses late payments** → Mitigation: dedicated EKS lookback fetch, not `loadBwaEuerPeriod` as-is.

## Migration Plan

Frontend-only. Rollback by reverting the route, `lib/eks-*`, invoice `paymentDate` UI, and nav links. Existing invoices without `paymentDate` remain valid for BWA.

## Open Questions

None for v1 (personal KV and vehicle km remain 0 until those documents exist).
