## 1. Categories

- [x] 1.1 Add `personal_tk_compulsory_health_insurance` and `personal_tk_compulsory_care_insurance` to `lib/euer-expense-category.ts` with wizard labels; keep them out of `OPERATING_EUER_CATEGORY_OPTIONS`
- [x] 1.2 Add `isCompulsoryTkHealthCare` and `isPersonalIncomeDeduction` (tax prepayment or TK Pflicht); do not overload `isPrivateTaxPrepayment`

## 2. Exclude from operating profit and VAT

- [x] 2.1 Exclude personal income deductions from `euerNet` / `vatQuarter` / `dashboard` in `lib/cost-report-aggregation.ts`
- [x] 2.2 Set `includeInAnnualEuer: false` for TK Pflicht in `lib/cost-reporting-periods.ts`
- [x] 2.3 Cost wizard (supplier invoice): same VAT-off flags as tax prepayment, default vendor Techniker Krankenkasse, hint that this is EKS Table C line 2 not Gewinn
- [x] 2.4 Upload-document page: same flags and hint
- [x] 2.5 BWA: skip TK Pflicht in Kostenarten; do not add to `privatsteuern` or `sonderausgaben`

## 3. EKS Table C

- [x] 3.1 `eksBLineFromCategory` returns null for TK Pflicht (never B14.5 / B4)
- [x] 3.2 `aggregateEksCForWindow` sums TK Pflicht persisted net EUR into `c_pflicht_kv` by payment date; rhythm `monatlich` when two or more payments; do not write `c_private_kv`; Table B loop continues to skip them

## 4. Tests

- [x] 4.1 Add `lib/eks-tk-compulsory.test.ts` (`node:test` + tsx) and an npm script covering: KV €400 → C line 2; PV €100 → C line 2 without changing Gewinn; combined €500; Gewinn 1190−200=990 with TK €500 on C; vendor TK / `insurance` not on line 2; empty window; payment outside Mar–Aug omitted; BWA Kostenarten unchanged
