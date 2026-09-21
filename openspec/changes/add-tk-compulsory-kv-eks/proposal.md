## Why

A Freiberufler who is pflichtversichert with Techniker Krankenkasse (TK) pays compulsory Krankenversicherung and Pflegeversicherung personally. Those amounts belong on Jobcenter-EKS **Table C line 2** (Absetzungen vom Einkommen), not on Table B Betriebsausgaben and not in EÜR/BWA Gewinn. ByteBills has no category for them yet, so Table C line 2 stays empty and using business `insurance` would wrongly hit EKS B4.

## What Changes

- Add two explicit cost categories (snake_case, same style as `tax_prepayment`):
  - `personal_tk_compulsory_health_insurance` (Pflicht KV)
  - `personal_tk_compulsory_care_insurance` (Pflicht PV)
- Enter them as **supplier invoices** (like tax prepayments): not Betriebsausgaben, no Vorsteuer, `includeInAnnualEuer` false.
- Fill EKS Table C line 2 (`c_pflicht_kv`, official German label) with the six-month **payment-date** total of those categories.
- Do **not** map them to Table C line 3 (freiwillig/privat), Table B, Summe Betriebsausgaben, Gewinn, EÜR operating expenses, or BWA Kostenarten.
- Do **not** infer Pflicht from vendor name “TK”. Category only.
- Do **not** add generic Krankenkassen, voluntary KV, or BWA Sonderausgaben in this change.

Assumptions:

- Cash-basis EKS `paymentDate` already exists; unpaid / no payment date omitted; no persisted EUR omitted.
- Negative net, if stored, reduces Table C line 2 (refunds).
- Source cost documents are not mutated at report time.
- Voluntary/private KV stays empty unless a later change adds an explicit category.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `eks-report`: Table C line 2 is filled from personally paid compulsory TK KV/PV cost categories by payment date; those costs remain excluded from Table B and from EÜR/BWA operating profit.

## Impact

- Category list and exclusion helpers: `lib/euer-expense-category.ts`, cost wizard, upload-document, `lib/cost-report-aggregation.ts`, `lib/cost-reporting-periods.ts`.
- EKS: `lib/eks-aggregate.ts` Table C; `lib/eks-category-map.ts` must not dump these categories into B14.5.
- BWA: skip these categories in Kostenarten; do not send them to Privatsteuern.
- Focused aggregator tests (`node:test` + tsx); no new Firestore collection.
