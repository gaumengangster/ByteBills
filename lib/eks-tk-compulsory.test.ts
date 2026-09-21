import assert from "node:assert/strict"
import { test } from "node:test"
import { aggregateBwa43ForRange } from "@/lib/bwa-43-aggregate"
import { BWA43_KOSTENARTEN } from "@/lib/bwa-43-model"
import { aggregateEksForSixMonths } from "@/lib/eks-aggregate"
import { emptyEksLeaves, type EksLeafId } from "@/lib/eks-model"
import {
  TK_COMPULSORY_KV_CATEGORY,
  TK_COMPULSORY_PV_CATEGORY,
} from "@/lib/euer-expense-category"

const B_LEAVES = Object.keys(emptyEksLeaves()).filter((k) => k.startsWith("b")) as EksLeafId[]

function approx(actual: number, expected: number, msg: string) {
  assert.ok(Math.abs(actual - expected) < 0.005, `${msg}: expected ${expected}, got ${actual}`)
}

function tkKv(amount: number, paymentDate: string, extras: Record<string, unknown> = {}) {
  return {
    type: "cost_invoice",
    category: TK_COMPULSORY_KV_CATEGORY,
    currency: "EUR",
    amountNet: amount,
    amountVat: 0,
    paymentDate,
    expenseDate: paymentDate,
    vendorName: "Techniker Krankenkasse",
    ...extras,
  }
}

function tkPv(amount: number, paymentDate: string) {
  return {
    type: "cost_invoice",
    category: TK_COMPULSORY_PV_CATEGORY,
    currency: "EUR",
    amountNet: amount,
    amountVat: 0,
    paymentDate,
    expenseDate: paymentDate,
    vendorName: "Techniker Krankenkasse",
  }
}

function eksMarAug(docs: { invoices?: Record<string, unknown>[]; costs?: Record<string, unknown>[] }) {
  return aggregateEksForSixMonths(
    { invoices: docs.invoices ?? [], costs: docs.costs ?? [], pauschalDocs: [] },
    2026,
    8,
  )
}

test("Test 1: compulsory TK health contribution → C line 2", () => {
  const grid = eksMarAug({ costs: [tkKv(400, "2026-03-15")] })
  const mar = grid.byMonth["2026-03"]!
  approx(grid.tableC.c_pflicht_kv.amount, 400, "C line 2")
  approx(grid.tableC.c_private_kv.amount, 0, "C line 3")
  for (const id of B_LEAVES) {
    assert.ok(Math.abs(mar[id] - 400) > 0.005, `Table B ${id} must not be 400`)
  }
})

test("Test 2: compulsory TK care contribution does not change Gewinn", () => {
  const without = eksMarAug({ costs: [] })
  const withPv = eksMarAug({ costs: [tkPv(100, "2026-03-15")] })
  const mar0 = without.byMonth["2026-03"]!
  const mar1 = withPv.byMonth["2026-03"]!
  approx(withPv.tableC.c_pflicht_kv.amount, 100, "C line 2 includes PV")
  approx(mar1.b_sum, mar0.b_sum, "Summe Betriebsausgaben")
  approx(mar1.gewinn, mar0.gewinn, "Gewinn")
})

test("Test 3: combined TK KV + PV", () => {
  const grid = eksMarAug({
    costs: [tkKv(400, "2026-03-15"), tkPv(100, "2026-03-15")],
  })
  approx(grid.tableC.c_pflicht_kv.amount, 500, "combined C line 2")
})

test("Test 4: Gewinn unchanged with TK 500", () => {
  const invoice = {
    status: "paid",
    taxDate: "2026-02-15",
    paymentDate: "2026-03-20",
    subtotalEur: 1000,
    taxEur: 190,
  }
  const rent = {
    type: "cost_partial_business_use",
    category: "homeoffice_miete",
    currency: "EUR",
    expenseDate: "2026-03-01",
    paymentDate: "2026-03-05",
    deductibleNetAmount: 200,
    deductibleVatAmount: 0,
  }
  const grid = eksMarAug({
    invoices: [invoice],
    costs: [rent, tkKv(400, "2026-03-10"), tkPv(100, "2026-03-10")],
  })
  const mar = grid.byMonth["2026-03"]!
  approx(mar.a_sum, 1190, "Betriebseinnahmen")
  approx(mar.b_sum, 200, "Betriebsausgaben")
  approx(mar.gewinn, 990, "Gewinn")
  approx(grid.tableC.c_pflicht_kv.amount, 500, "C line 2")
})

test("Test 5: vendor TK / insurance is not compulsory", () => {
  const grid = eksMarAug({
    costs: [
      {
        type: "cost_invoice",
        category: "insurance",
        currency: "EUR",
        amountNet: 400,
        amountVat: 0,
        paymentDate: "2026-03-15",
        expenseDate: "2026-03-15",
        vendorName: "Techniker Krankenkasse",
      },
    ],
  })
  approx(grid.tableC.c_pflicht_kv.amount, 0, "not C line 2")
  approx(grid.tableC.c_private_kv.amount, 0, "not C line 3")
  approx(grid.byMonth["2026-03"]!.b4, 400, "business insurance still B4")
})

test("Test 6: no compulsory TK data", () => {
  const grid = eksMarAug({ costs: [] })
  approx(grid.tableC.c_pflicht_kv.amount, 0, "empty C line 2")
})

test("Test 7: payment outside six-month window", () => {
  const grid = eksMarAug({ costs: [tkKv(400, "2026-02-01")] })
  approx(grid.tableC.c_pflicht_kv.amount, 0, "outside window")
})

test("BWA Kostenarten exclude TK Pflicht", () => {
  const bwa = aggregateBwa43ForRange({
    range: { from: "2026-03-01", to: "2026-03-31" },
    invoices: [],
    euerCosts: [tkKv(400, "2026-03-15")],
    vatCosts: [],
    pauschalDocs: [],
    assetDocs: [],
  })
  for (const id of BWA43_KOSTENARTEN) {
    approx(bwa[id], 0, `BWA Kostenart ${id}`)
  }
  approx(bwa.privatsteuern, 0, "not Privatsteuern")
  approx(bwa.sonderausgaben, 0, "not Sonderausgaben")
})

test("BWA skips cancelled invoices in Betriebseinnahmen", () => {
  const range = { from: "2026-09-01", to: "2026-09-30" }
  const empty = {
    range,
    euerCosts: [] as Array<Record<string, unknown>>,
    vatCosts: [] as Array<Record<string, unknown>>,
    pauschalDocs: [] as Array<Record<string, unknown>>,
    assetDocs: [] as Array<Record<string, unknown>>,
  }
  const cancelledPaid = {
    type: "invoices",
    status: "canceled",
    taxDate: "2026-09-10",
    paymentDate: "2026-09-12",
    subtotalEur: 1500,
    taxEur: 285,
  }
  const activePaid = {
    type: "invoices",
    status: "paid",
    taxDate: "2026-09-08",
    paymentDate: "2026-09-09",
    subtotalEur: 1000,
    taxEur: 190,
  }
  const onlyCancelled = aggregateBwa43ForRange({ ...empty, invoices: [cancelledPaid] })
  approx(onlyCancelled.erloese_betrieblich, 0, "cancelled Erlöse")
  approx(onlyCancelled.umsatzsteuer, 0, "cancelled USt")
  approx(onlyCancelled.zugang_forderungen, 0, "cancelled Forderungen")
  approx(onlyCancelled.betriebseinnahmen, 0, "cancelled Betriebseinnahmen")

  const mixed = aggregateBwa43ForRange({ ...empty, invoices: [cancelledPaid, activePaid] })
  approx(mixed.erloese_betrieblich, 1000, "active Erlöse")
  approx(mixed.umsatzsteuer, 190, "active USt")
  approx(mixed.zugang_forderungen, 0, "paid no Forderungen")
  approx(mixed.betriebseinnahmen, 1190, "active Betriebseinnahmen")
})

test("BWA hardware and furniture go to EDV/GWG not Instandhaltung", () => {
  const bwa = aggregateBwa43ForRange({
    range: { from: "2026-03-01", to: "2026-03-31" },
    invoices: [],
    euerCosts: [
      {
        type: "cost_invoice",
        category: "hardware",
        currency: "EUR",
        amountNet: 400,
        amountVat: 0,
        expenseDate: "2026-03-10",
        includeInAnnualEuer: true,
      },
      {
        type: "cost_invoice",
        category: "furniture",
        currency: "EUR",
        amountNet: 150,
        amountVat: 0,
        expenseDate: "2026-03-12",
        includeInAnnualEuer: true,
      },
    ],
    vatCosts: [],
    pauschalDocs: [],
    assetDocs: [],
  })
  approx(bwa.edv_buero_gwg, 550, "EDV/GWG")
  approx(bwa.instandhaltung, 0, "not Instandhaltung")
  approx(bwa.verschiedene_kosten, 0, "not Verschiedene")
})
