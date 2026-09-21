## Why

ByteBills already has invoices, costs, BWA 43, and EÜR hints, but nothing that matches **Jobcenter-EKS** (Erklärung zum Einkommen aus selbständiger Tätigkeit): six calendar-month columns, Table A Einnahmen, Table B Betriebsausgaben with carry-forwards, Gewinn, and Table C Absetzungen. Freelancers filling Bürgergeld / SGB II need those figures copyable from the books for a Bewilligungszeitraum (e.g. March–August).

## What Changes

- Add an authenticated **EKS** page (`/eks`) with a six-month window (default: last six calendar months ending in the current month, e.g. March–August 2026).
- Recreate **Table A**, **Table B Teil 1–3**, and **Table C** with German Jobcenter-EKS 04/2026 line labels.
- Each of Tables A and B has **one column per calendar month** plus a computed **Summe** column for the six-month total.
- Add a **payment date** on issued invoices (create, edit, mark-as-paid). Persist `paymentDate` (`yyyy-MM-dd`).
- Auto-fill EKS from **payment dates** (cash basis): invoices by `paymentDate`, costs by `paymentDate`. Do not use Leistungsdatum (`taxDate`) or `expenseDate` for EKS month columns. Unpaid documents (no payment date) are omitted. Unmapped lines stay empty / €0.
- Calculate Zwischensumme, Übertrag, Summe der Betriebseinnahmen, Summe Betriebsausgaben, and Gewinn per month and for the period.
- Toggle **vorläufige Erklärung** vs **abschließende Erklärung** (UI only, not persisted).
- Link from navbar (and dashboard/home if BWA is already linked there).
- Disclaimer: fill aid for Jobcenter-EKS, not a tax or SGB II decision.

Assumptions:

- Sales receipts stay out of A1.
- Persisted EUR only (no live FX).
- BWA / EÜR / ELSTER stay on `taxDate` / `expenseDate` (Soll). Only EKS is cash-basis.
- Rent / home-office share (`homeoffice_miete`) → B3; business `insurance` → B4; tax prepayments → Table C, not Betriebsausgaben (still by **payment** date).
- Personal health insurance has no category yet → Table C private KV stays €0 until recorded.
- Pauschale (non-cash legal deduction) is the only exception: still split by overlapping period months.
- No new Firestore collection; invoices gain an optional `paymentDate` field on existing `invoices` documents.

## Capabilities

### New Capabilities

- `eks-report`: Jobcenter-EKS Tables A, B (parts 1–3), and C for a six-month window, auto-filled on **payment dates**, with calculated subtotals and profit; issued invoices store a payment date.

### Modified Capabilities

- None.

## Impact

- New route `app/eks/`, `lib/eks-*.ts` for model, category map, and **payment-date** monthly aggregation.
- Invoice create/edit/detail/actions: `paymentDate` on `invoices`. Cost wizard writes `paymentDate` when status is paid (schema already allows it).
- EKS loader must include documents paid in the window even if `invoiceDate` / `expenseDate` is outside it. Do not reuse BWA year filters unchanged.
- Touch navbar; optional dashboard and home links next to BWA / EÜR.
- No PDF in this change.
