## MODIFIED Requirements

### Requirement: Table C Absetzungen vom Einkommen
The system SHALL render Table C with the official three columns: Art der Absetzung, Höhe in Euro, Zahlungsrhythmus. Rows MUST include Einkommensteuervorauszahlungen; Pflichtbeiträge zur Kranken-/Pflege- und/oder Rentenversicherung; private or voluntary statutory health and care insurance; pension insurance; capital-forming life insurance; Versorgungseinrichtung; motor-vehicle liability (without Kasko); other legally required insurance; Riester; and andere Absetzungen.

Tax prepayments **paid** in the six-month window MUST fill the Einkommensteuervorauszahlungen Höhe with the period total (by payment date) and Zahlungsrhythmus `monatlich` when amounts occur monthly.

Personally paid **compulsory** Techniker Krankenkasse Krankenversicherung and Pflegeversicherung costs **paid** in the six-month window MUST fill Table C line 2 (Pflichtbeiträge zur Kranken-/Pflege- und/oder Rentenversicherung) with the period total (by payment date) and Zahlungsrhythmus `monatlich` when amounts occur monthly. Those amounts MUST NOT appear on Table C line 3 (private or voluntary statutory health and care insurance), MUST NOT appear on any Table B line, and MUST NOT change Summe Betriebsausgaben or Gewinn.

The system MUST NOT treat a cost as compulsory TK Pflicht solely because the vendor name contains “TK” or “Techniker Krankenkasse”. Only the explicit compulsory TK categories qualify for line 2. A cost categorized as business insurance, or as voluntary/private KV only if such a category exists, MUST NOT increase line 2.

Foreign-currency costs without persisted EUR MUST be omitted. Negative persisted net EUR MUST reduce the line 2 total. Other C rows with no source MUST stay empty. Line 2 with amount 0 MUST follow the existing Table C blank-cell convention.

#### Scenario: Tax prepayment on Table C
- **GIVEN** six monthly tax-prepayment costs of €500 each with payment dates from March through August 2026
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Einkommensteuervorauszahlungen Höhe is €3.000,00
- **AND** Zahlungsrhythmus is monatlich
- **AND** that amount is not in Table B

#### Scenario: Compulsory TK health contribution on Table C line 2
- **GIVEN** a personally paid compulsory TK Krankenversicherung cost of €400 with payment date 2026-03-15
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Pflichtbeiträge zur Kranken-/Pflege- und/oder Rentenversicherung Höhe is €400,00
- **AND** Table C private / voluntary health insurance Höhe is empty
- **AND** no Table B line includes that €400,00

#### Scenario: Compulsory TK care contribution on Table C line 2
- **GIVEN** a personally paid compulsory TK Pflegeversicherung cost of €100 with payment date 2026-03-15
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Pflichtbeiträge Höhe includes €100,00
- **AND** Summe Betriebsausgaben and Gewinn are the same as without that cost

#### Scenario: Combined TK KV and PV on Table C line 2
- **GIVEN** compulsory TK Krankenversicherung €400 and Pflegeversicherung €100, both paid in March 2026
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Pflichtbeiträge Höhe is €500,00

#### Scenario: Gewinn unchanged by TK Pflichtbeiträge
- **GIVEN** March Betriebseinnahmen €1.190,00, March Betriebsausgaben €200,00, and personally paid compulsory TK contributions €500,00 in March
- **WHEN** the user views EKS for March–August 2026
- **THEN** March Summe der Betriebseinnahmen is €1.190,00
- **AND** March Summe Betriebsausgaben is €200,00
- **AND** March Gewinn is €990,00
- **AND** Table C Pflichtbeiträge Höhe is €500,00

#### Scenario: Vendor name TK is not enough
- **GIVEN** a cost with vendor Techniker Krankenkasse, category business insurance (or any category that is not compulsory TK Pflicht), payment date in March 2026
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Pflichtbeiträge does not include that cost
- **AND** Table C private / voluntary health insurance stays empty unless the cost uses an explicit voluntary/private category

#### Scenario: Private KV empty without data
- **GIVEN** a user with no voluntary/private health-insurance cost category in the window
- **WHEN** they view Table C
- **THEN** private / voluntary health insurance Höhe is empty

#### Scenario: No compulsory TK in the window
- **GIVEN** a user with no compulsory TK KV/PV cost paid in March–August 2026
- **WHEN** they view EKS for that window
- **THEN** Table C Pflichtbeiträge Höhe is blank according to the existing Table C empty-cell convention

#### Scenario: Compulsory TK payment outside the window
- **GIVEN** a compulsory TK KV cost with payment date 2026-02-01
- **WHEN** the user views EKS for March–August 2026
- **THEN** Table C Pflichtbeiträge does not include that cost

## ADDED Requirements

### Requirement: Compulsory TK cost categories are not Betriebsausgaben
The system SHALL let a signed-in user record personally paid compulsory Techniker Krankenkasse Krankenversicherung and Pflegeversicherung as two distinct cost categories on a supplier invoice: Pflicht KV and Pflicht PV. Those categories MUST be excluded from EÜR operating expenses, ELSTER Vorsteuer, and BWA Kostenarten. They MUST NOT be booked as BWA Privatsteuern (that line remains tax prepayments).

#### Scenario: User can choose TK Pflicht KV
- **GIVEN** a signed-in user adding a supplier cost
- **WHEN** they open the category list
- **THEN** they can select compulsory TK Krankenversicherung as a distinct category from business insurance and tax prepayment

#### Scenario: User can choose TK Pflicht PV
- **GIVEN** a signed-in user adding a supplier cost
- **WHEN** they open the category list
- **THEN** they can select compulsory TK Pflegeversicherung as a distinct category from Pflicht KV and business insurance

#### Scenario: TK Pflicht excluded from EÜR and BWA Kostenarten
- **GIVEN** a paid compulsory TK KV cost of €400 with expense date in March 2026
- **WHEN** BWA 43 and EÜR operating totals are calculated for March 2026
- **THEN** that €400,00 is not included in BWA Kostenarten
- **AND** that €400,00 is not included in EÜR operating expense lines
- **AND** that €400,00 is not included in BWA Privatsteuern
