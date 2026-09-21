## Context

See `proposal.md`. Specs: `specs/eks-report/spec.md`.

EKS Table C already sums `tax_prepayment` into `c_est` by `paymentDate` in `aggregateEksCForWindow`. Line 2 (`c_pflicht_kv`) and line 3 (`c_private_kv`) are labeled but unused. Business `insurance` maps to Table B4. Tax prepayments are excluded from `euerNet` / VAT and shown on BWA as Privatsteuern via `isPrivateTaxPrepayment` — TK Pflicht MUST use a **separate** helper so it is not dumped onto Privatsteuern.

Entry path already used for personal cash outflows: supplier `cost_invoice` + category, recurring months, `paymentDate` when paid.

## Goals / Non-Goals

**Goals:**

- Two explicit snake_case categories, both mapping to EKS `c_pflicht_kv`.
- Same cash-basis window and payment-date rules as existing EKS costs.
- Exclude from Table B, EÜR operating, BWA Kostenarten, and Vorsteuer.

**Non-Goals:**

- Other Krankenkassen or a generic “all providers” insurance-status field.
- Table C line 3 (freiwillig/privat).
- BWA Sonderausgaben / Privatsteuern for KV.
- Inferring Pflicht from vendor name.
- New Firestore collection or mutating source docs at report time.
- Combined third category (line 2 already sums KV+PV).

## Decisions

### 1. Two categories, snake_case

- `personal_tk_compulsory_health_insurance`
- `personal_tk_compulsory_care_insurance`

Match `tax_prepayment`. Wizard labels: TK compulsory KV (Pflicht) / TK compulsory PV (Pflicht). Default vendor when selected: Techniker Krankenkasse (hint only, not a classifier).

**Alternative considered:** One combined `personal_tk_compulsory_health_care`. Rejected: the domain already supports separate categories; TK contribution statements split KV and PV; both still land on the same EKS line.

**Alternative considered:** Infer from vendor “TK”. Rejected by spec: category only.

### 2. Do not overload `isPrivateTaxPrepayment`

Add `isCompulsoryTkHealthCare` and `isPersonalIncomeDeduction` (tax **or** TK Pflicht). Use the latter for euerNet/VAT/EÜR-flag exclusion. BWA keeps the tax-only branch to `privatsteuern`; TK Pflicht is skipped in the operating loop and not added to any BWA leaf.

**Alternative considered:** Extend `isPrivateTaxPrepayment`. Rejected: KV is not a tax and must not appear as Privatsteuern.

### 3. Table C aggregation only

Extend `aggregateEksCForWindow` to add persisted net EUR to `c_pflicht_kv`. Rhythm: `monatlich` if two or more qualifying payments in the window, else `zu bestimmten Terminen`. `eksBLineFromCategory` returns null for these categories (same as tax) so they never become B14.5.

Reuse existing lookback loader; no new fetch.

### 4. Tests without a new framework

No Jest/Vitest in the repo. Add `lib/eks-tk-compulsory.test.ts` with `node:test` run via `tsx`, covering the spec scenarios against aggregators (not Firestore).

## Risks / Trade-offs

- **[Risk] Historical TK payments stored as `insurance` stay on B4** → Mitigation: no backfill; user recategorizes. Document in wizard hint.
- **[Risk] One SEPA for KV+PV** → Mitigation: user may split into two costs or put the total on one Pflicht category; line 2 is the sum.
- **[Trade-off]** BWA Sonderausgaben stays empty for KV → Mitigation: EKS Table C is the Jobcenter target; keep BWA profit clean.

## Migration Plan

Frontend-only category values on existing `cost_invoice` documents. Rollback by reverting category helpers and EKS C mapping. Existing docs without the new categories are unchanged.

## Open Questions

None for v1 (freiwillig/privat KV deferred).
