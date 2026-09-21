## 1. BWA 43 model and aggregation

- [x] 1.1 Add `lib/bwa-43-model.ts` with every BWA 43 line (German label, section, percent kind) and `finalizeBwa43` identities (Summe Erlöse, Betriebseinnahmen, Summe Kosten, Betriebsausgaben, Gewinn, Liquidität)
- [x] 1.2 Add monthly AfA helper and `lib/bwa-43-aggregate.ts` mapping invoices (Erlöse, USt, Zugang Forderungen), costs, Pauschalen, AfA, Vorsteuer, Anlagenzugänge into leaf lines for a date range
- [x] 1.3 Add `lib/bwa-euer-year-load.ts` loading a calendar year of invoices/costs/pauschal/assets/company, returning month BWA, YTD BWA, and annual EÜR

## 2. Page and PDF

- [x] 2.1 Create authenticated `app/bwa-euer/page.tsx` with year + month selects (default current), KPI cards, BWA 43 table (month + YTD + %), EÜR tab, disclaimer
- [x] 2.2 Add `lib/bwa-43-pdf.ts` (jsPDF + Roboto) matching BWA 43 header/columns/all lines/footer; filename includes BWA, 43, year, month; wire Download

## 3. Navigation

- [x] 3.1 Add BWA / EÜR to navbar (desktop + mobile)
- [x] 3.2 Link from home feature area and dashboard
- [x] 3.3 Replace reports full EÜR table with a link card to `/bwa-euer`

## 4. Verify

- [x] 4.1 Check guest redirect, default current month, YTD label, empty lines at €0, PDF download
- [x] 4.2 Confirm nav/home/dashboard/reports links
