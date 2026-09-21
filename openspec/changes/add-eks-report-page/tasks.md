## 1. Invoice and cost payment dates

- [x] 1.1 Persist `paymentDate` (`yyyy-MM-dd`) on `invoices`; add the field to create and edit forms next to due date
- [x] 1.2 When marking an invoice paid, set `paymentDate` to today if empty; show payment date on invoice detail (and list if space)
- [x] 1.3 Cost wizard: when payment status is paid, write `paymentDate` (default expense date) on `cost_invoice` and `cost_partial_business_use`

## 2. EKS model and aggregation

- [x] 2.1 Add `lib/eks-model.ts` with all Table A / B / C line ids, German labels, section, and `kind` (leaf | carry | total), plus `finalizeEks` identities (A Summe, B Teil 1–3 Zwischensumme/Übertrag, Summe Betriebsausgaben, Gewinn)
- [x] 2.2 Add `lib/eks-category-map.ts` mapping ByteBills categories and pauschale types to B-lines (B3 rent, B4 insurance, B6.5 mileage, B7.2 travel, B8 AfA purchase, B10 office, B11 internet, B13 education, B14.3 bank, B14.5 leftover); tax prepayment excluded from B
- [x] 2.3 Add `lib/eks-aggregate.ts` to fill leaf amounts by **payment date** (invoices A1/A5.1, costs deductible EUR); omit docs with no paymentDate; pauschale still by period overlap; six-month loop + Summe column
- [x] 2.4 Load documents with a lookback so payments in the window are included even if invoice/expense date is earlier; do not rely on BWA `invoiceDate` / `euerYear` filters alone

## 3. Page

- [x] 3.1 Create authenticated `app/eks/page.tsx` (and `loading.tsx`) with year + end-month selects (default current month → last six months), vorläufige/abschließende toggle, Tables A, B Teil 1–3, Table C, `de-DE` EUR, blank leaf zeros, disclaimer
- [x] 3.2 Rebuild on period change

## 4. Navigation

- [x] 4.1 Add EKS to navbar (desktop + mobile) next to BWA / EÜR
- [x] 4.2 Link from dashboard and home feature area where BWA is already linked

## 5. Verify

- [x] 5.1 Check guest redirect, default March–August 2026 in August 2026, six month columns + Summe, calculated Übertrag/Gewinn, blank unmapped lines
- [x] 5.2 Confirm invoice payment-date field and mark-as-paid; invoice with February Leistungsdatum and March payment appears in March A1 only
- [x] 5.3 Confirm cost paid in April with March expense date appears in April B; unpaid omitted; tax prepayments on Table C by payment date, not Table B
- [x] 5.4 Confirm nav / dashboard / home links; BWA still uses taxDate / expenseDate
