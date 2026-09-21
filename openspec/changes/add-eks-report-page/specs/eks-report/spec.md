## Purpose

Lets signed-in users calculate Jobcenter-EKS Tables A, B (parts 1–3), and C for a six-calendar-month window, auto-filled from **paid** invoices and costs by payment date, with per-month columns and calculated subtotals, carry-forwards, and profit.

## ADDED Requirements

### Requirement: Authenticated EKS page
The system SHALL provide a dedicated EKS page at `/eks` that is available only to a signed-in user. An unauthenticated visitor MUST be sent to the login flow.

#### Scenario: Signed-in user opens the page
- **GIVEN** a signed-in user
- **WHEN** the user navigates to `/eks`
- **THEN** the page loads with a six-month window and Tables A, B, and C

#### Scenario: Guest is redirected
- **GIVEN** a visitor who is not signed in
- **WHEN** the visitor requests `/eks`
- **THEN** the system redirects them to the login page

### Requirement: Six calendar-month columns
The system SHALL show Tables A and B with one column per calendar month for a contiguous six-month window, plus a Summe column that is the sum of those six months for each row. Selectors MUST default to the six calendar months ending in the current month. Changing the end month MUST rebuild all six columns. Amounts MUST be EUR formatted `de-DE`. Leaf lines with amount 0 MUST render as a blank cell; calculated rows MUST still include those zeros in the arithmetic.

#### Scenario: Default window in August 2026
- **GIVEN** a signed-in user opening `/eks` in August 2026
- **WHEN** the page finishes loading
- **THEN** the six columns are labeled March 2026 through August 2026
- **AND** a seventh column is labeled Summe

#### Scenario: Recalculate on end-month change
- **GIVEN** a signed-in user viewing March–August 2026
- **WHEN** the user selects end month February 2026
- **THEN** the six columns are September 2025 through February 2026

### Requirement: Declaration type
The system SHALL let the user mark the view as **vorläufige Erklärung** or **abschließende Erklärung**. The default MUST be vorläufige Erklärung. The choice MUST NOT be persisted.

#### Scenario: Default is preliminary
- **GIVEN** a signed-in user opening `/eks`
- **WHEN** the page finishes loading
- **THEN** vorläufige Erklärung is selected

### Requirement: Invoice payment date
The system SHALL store an optional `paymentDate` (`yyyy-MM-dd`) on issued invoices. Create and edit invoice forms MUST include a payment-date field. Marking an invoice as paid MUST set `paymentDate` (default: today) if it is empty. Clearing paid status MAY clear `paymentDate`. BWA, EÜR, and ELSTER MUST continue to use Leistungsdatum (`taxDate`), not `paymentDate`.

#### Scenario: Mark invoice paid records payment date
- **GIVEN** a signed-in user viewing an unpaid invoice with no payment date
- **WHEN** they mark the invoice as paid and confirm
- **THEN** the invoice status is paid
- **AND** `paymentDate` is stored as today’s date unless they entered another date

#### Scenario: Edit payment date independently of invoice date
- **GIVEN** a paid invoice with invoice date 2026-02-01 and payment date 2026-03-20
- **WHEN** the user opens the invoice edit form
- **THEN** they can change the payment date without changing the invoice date or Leistungsdatum

### Requirement: Table A Betriebseinnahmen
The system SHALL render Table A with German Jobcenter-EKS labels: A1 Betriebseinnahmen; A2 Privatentnahmen von Waren; A3 sonstige betriebliche Einnahmen; A4 Zuwendungen von Dritten; A5.1 vereinnahmte Umsatzsteuer; A5.2 Umsatzsteuer auf Privatentnahmen von Waren; A5.3 vom Finanzamt erstattete Umsatzsteuer; Summe der Betriebseinnahmen.

For each month column, Summe der Betriebseinnahmen MUST equal A1 + A2 + A3 + A4 + A5.1 + A5.2 + A5.3.

Issued invoices that are not cancelled MUST map into A1 (net EUR) and A5.1 (output VAT) by **payment date**, not Leistungsdatum (`taxDate`) and not invoice date. An invoice without a payment date MUST be omitted from Table A even if it is dated in the window. Sales receipts MUST NOT increase A1. Lines without a ByteBills source MUST stay 0 (blank cells). Foreign-currency documents without persisted EUR MUST be omitted. The system MUST NOT apply a live exchange rate.

#### Scenario: Paid invoice counted in payment month
- **GIVEN** one issued invoice with Leistungsdatum 2026-02-15, payment date 2026-03-20, net EUR 1,000, output VAT EUR 190, status paid, not cancelled
- **WHEN** the user views EKS for March–August 2026
- **THEN** March A1 is €1.000,00
- **AND** March A5.1 is €190,00
- **AND** February A1 does not include that €1.000,00
- **AND** March Summe der Betriebseinnahmen is €1.190,00
- **AND** the Summe column for A1 includes that €1.000,00

#### Scenario: Unpaid invoice omitted
- **GIVEN** one issued invoice with Leistungsdatum 2026-03-15, no payment date, status pending
- **WHEN** the user views EKS for March–August 2026
- **THEN** March A1 does not include that invoice

#### Scenario: Receipts are not A1
- **GIVEN** a signed-in user with a sales receipt in March 2026 and no invoices that month
- **WHEN** they view EKS for March–August 2026
- **THEN** March A1 is blank / €0

#### Scenario: Unmapped A lines stay empty
- **GIVEN** a user with invoices in March 2026 and no private withdrawals or grants
- **WHEN** they view EKS
- **THEN** March A2, A3, A4, A5.2, and A5.3 are blank

### Requirement: Table B Betriebsausgaben and Gewinn
The system SHALL render Table B in three parts with German Jobcenter-EKS 04/2026 line labels, including B1 through B18, personnel and vehicle sub-lines, and the private-kilometer deduction row.

Per month column the system MUST calculate:

- Teil 1 Zwischensumme = B1 + B2.1 + B2.2 + B2.3 + B2.4 + B3 + B4 + B5
- Teil 2 Übertrag = Teil 1 Zwischensumme
- Teil 2 Zwischensumme = Übertrag + B6.1 + B6.2 + B6.3 + B6.4 − private-kilometer deduction + B6.5 + B7.1 + B7.2 + B7.3 + B8 + B9 + B10
- Teil 3 Übertrag = Teil 2 Zwischensumme
- Summe Betriebsausgaben = Übertrag + B11 + B12 + B13 + B14.1 + B14.2 + B14.3 + B14.4 + B14.5 + B15 + B16 + B17 + B18
- Gewinn = Table A Summe der Betriebseinnahmen − Summe Betriebsausgaben

Supplier operating costs (deductible amounts for partial business use; not AfA purchase net as a Kostenart) MUST map by **payment date** and category, not expense date. A cost without a payment date MUST be omitted from Table B even if its expense date is in the window.

- home office / rent share → B3
- business insurance → B4
- travel → B7.2
- asset purchases → B8
- office supplies → B10
- internet / telecom → B11
- education → B13
- bank fees → B14.3
- remaining operating costs (including software, subscriptions, hardware, furniture, other, untagged) → B14.5
- input VAT on eligible costs → B17
- mileage pauschale → B6.5

Income-tax, trade-tax, and Solidaritätszuschlag Vorauszahlungen MUST NOT increase Table B. Foreign-currency costs without persisted EUR MUST be omitted. Lines without a mapped source MUST stay 0 (blank cells). Non-cash Pauschale deductions MAY still be allocated by overlapping period months (not payment date).

#### Scenario: Rent share counted in payment month
- **GIVEN** a partial-business-use cost with expense date 2026-03-01, payment date 2026-04-05, category home office / rent share, and deductible net EUR 200
- **WHEN** the user views EKS for March–August 2026
- **THEN** April B3 is €200,00
- **AND** March B3 does not include that €200,00
- **AND** April Teil 1 Zwischensumme includes that €200,00

#### Scenario: Unpaid cost omitted
- **GIVEN** a supplier cost with expense date 2026-03-10, payment status unpaid, and no payment date
- **WHEN** the user views EKS for March–August 2026
- **THEN** March Table B does not include that cost

#### Scenario: Tax prepayment is not Betriebsausgabe
- **GIVEN** a paid cost of €2.000 with payment date 2026-03-10 with category Tax prepayment (ESt / GewSt / Soli)
- **WHEN** the user views EKS for March–August 2026
- **THEN** March Table B lines and Summe Betriebsausgaben do not include that €2.000,00

#### Scenario: Gewinn from income minus expenses
- **GIVEN** March A Summe der Betriebseinnahmen €1.190,00 and March Summe Betriebsausgaben €200,00
- **WHEN** the user views EKS
- **THEN** March Gewinn is €990,00

#### Scenario: Carry-forward matches prior subtotal
- **GIVEN** March Teil 1 Zwischensumme €200,00 and no Teil 2 leaf amounts in March
- **WHEN** the user views Table B Teil 2
- **THEN** March Übertrag is €200,00
- **AND** March Teil 2 Zwischensumme is €200,00

### Requirement: Table C Absetzungen vom Einkommen
The system SHALL render Table C with the official three columns: Art der Absetzung, Höhe in Euro, Zahlungsrhythmus. Rows MUST include Einkommensteuervorauszahlungen; Pflichtbeiträge zur Kranken-/Pflege- und/oder Rentenversicherung; private or voluntary statutory health and care insurance; pension insurance; capital-forming life insurance; Versorgungseinrichtung; motor-vehicle liability (without Kasko); other legally required insurance; Riester; and andere Absetzungen.

Tax prepayments **paid** in the six-month window MUST fill the Einkommensteuervorauszahlungen Höhe with the period total (by payment date) and Zahlungsrhythmus `monatlich` when amounts occur monthly. Personal health insurance MUST stay €0 until such costs exist in ByteBills. Other C rows with no source MUST stay empty.

#### Scenario: Tax prepayment on Table C
- **GIVEN** six monthly tax-prepayment costs of €500 each with payment dates from March through August 2026
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Einkommensteuervorauszahlungen Höhe is €3.000,00
- **AND** Zahlungsrhythmus is monatlich
- **AND** that amount is not in Table B

#### Scenario: Private KV empty without data
- **GIVEN** a user with no health-insurance cost category in the window
- **WHEN** they view Table C
- **THEN** private / voluntary health insurance Höhe is empty

### Requirement: Disclaimer and navigation
The system SHALL state that the page is a fill aid for Jobcenter-EKS and not a substitute for tax advice or a Jobcenter decision. The main navigation MUST include an EKS item that goes to `/eks`.

#### Scenario: Nav link
- **GIVEN** a signed-in user on any authenticated page with the main nav
- **WHEN** they open the main navigation
- **THEN** an EKS item is present and goes to `/eks`

#### Scenario: Disclaimer visible
- **GIVEN** a signed-in user on `/eks`
- **WHEN** the page renders
- **THEN** a disclaimer is visible that this is not tax or SGB II advice
