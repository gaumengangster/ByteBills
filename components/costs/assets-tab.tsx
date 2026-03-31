"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore"
import { format } from "date-fns"
import { db } from "@/lib/firebase"
import {
  DEFAULT_EUR_ZEILE,
  DEFAULT_USEFUL_LIFE,
  type AssetCategory,
  type AssetDoc,
  type AssetEurZeile,
  type DepreciationMethod,
} from "@/lib/asset-cost-types"
import { assetDepreciationForCalendarYearEur, remainingBookValueAfterCalendarYearEur } from "@/lib/eur-euer-yearly"
import { buildAssetCommonFields, yearQuarterFromYmd } from "@/lib/cost-common-fields"
import { buildCostAusgabeUploadedFilename } from "@/lib/document-filename"
import { fetchNextCostSequenceNumber } from "@/lib/cost-sequence"
import { CostReportingBadge, FieldHint } from "@/components/costs/cost-reporting-badge"
import { getGoogleDriveAccessToken, deleteGoogleDriveFile, uploadFileToGoogleDrive } from "@/lib/google-drive-upload-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"

const CAT_LABEL: Record<AssetCategory, string> = {
  hardware: "Hardware (e.g. laptop, monitor)",
  software: "Software / licenses",
  furniture: "Furniture / fixtures",
}

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const

type Props = { userId: string }

async function cloneFileForUpload(file: File): Promise<File> {
  return new File([await file.arrayBuffer()], file.name, { type: file.type })
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-tight">{children}</h3>
}

export function AssetsTab({ userId }: Props) {
  const [rows, setRows] = useState<Array<{ id: string; data: Record<string, unknown> }>>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState<AssetCategory>("hardware")
  const [name, setName] = useState("")
  const [vendor, setVendor] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [purchasePriceEur, setPurchasePriceEur] = useState("")
  const [vatAmountEur, setVatAmountEur] = useState("")
  const [currency, setCurrency] = useState<string>("EUR")
  const [usefulLifeYears, setUsefulLifeYears] = useState(String(DEFAULT_USEFUL_LIFE.hardware))
  const [method, setMethod] = useState<DepreciationMethod>("linear")
  const [eurZeile, setEurZeile] = useState<AssetEurZeile>("Z.44")
  const [businessUsePercent, setBusinessUsePercent] = useState("100")
  const [depreciationStartMonth, setDepreciationStartMonth] = useState(format(new Date(), "yyyy-MM"))
  const [receiptUrl, setReceiptUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [businessPurpose, setBusinessPurpose] = useState("")
  const [documentFile, setDocumentFile] = useState<File | null>(null)

  const calendarYear = new Date().getFullYear()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(collection(db, "assets"), where("userId", "==", userId), limit(500))
      const snap = await getDocs(q)
      const list = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      list.sort((a, b) => String(b.data.createdAt ?? "").localeCompare(String(a.data.createdAt ?? "")))
      setRows(list)
    } catch (e) {
      console.error(e)
      toast({
        title: "Could not load assets",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setUsefulLifeYears(String(DEFAULT_USEFUL_LIFE[category]))
    setEurZeile(DEFAULT_EUR_ZEILE[category])
  }, [category])

  const parsed = useMemo(() => {
    const net = Number.parseFloat(purchasePriceEur.replace(",", "."))
    const vat = vatAmountEur.trim() === "" ? 0 : Number.parseFloat(vatAmountEur.replace(",", "."))
    const life = Number.parseInt(usefulLifeYears, 10)
    const gross = (Number.isFinite(net) ? net : 0) + (Number.isFinite(vat) ? vat : 0)
    const annual = Number.isFinite(net) && net > 0 && Number.isFinite(life) && life > 0 ? net / life : 0
    const bp = Number.parseFloat(businessUsePercent.replace(",", "."))
    const businessPct = Number.isFinite(bp) ? Math.min(100, Math.max(0, bp)) : 100
    return { net: Number.isFinite(net) ? net : 0, vat: Number.isFinite(vat) ? vat : 0, gross, annual, life, businessPct }
  }, [purchasePriceEur, vatAmountEur, usefulLifeYears, businessUsePercent])

  const depreciationStartYmd = `${depreciationStartMonth}-01`

  const previewDoc = useMemo(
    () =>
      ({
        purchasePriceEur: parsed.net,
        usefulLifeYears: parsed.life,
        purchaseDate: purchaseDate.slice(0, 10),
        depreciationSchedule: "monthly",
        depreciationStartYmd,
        businessUsePercent: parsed.businessPct,
      }) as Record<string, unknown>,
    [parsed.net, parsed.life, parsed.businessPct, purchaseDate, depreciationStartYmd],
  )

  const previewYtd = useMemo(
    () => assetDepreciationForCalendarYearEur(previewDoc, calendarYear),
    [previewDoc, calendarYear],
  )

  const previewRemaining = useMemo(() => {
    if (parsed.net <= 0 || parsed.life <= 0) return 0
    return remainingBookValueAfterCalendarYearEur(parsed.net, parsed.life, depreciationStartYmd, calendarYear)
  }, [parsed.net, parsed.life, depreciationStartYmd, calendarYear])

  const openNew = () => {
    const today = format(new Date(), "yyyy-MM-dd")
    const ym = format(new Date(), "yyyy-MM")
    setCategory("hardware")
    setName("")
    setVendor("")
    setPurchaseDate(today)
    setPurchasePriceEur("")
    setVatAmountEur("")
    setCurrency("EUR")
    setUsefulLifeYears(String(DEFAULT_USEFUL_LIFE.hardware))
    setMethod("linear")
    setEurZeile("Z.44")
    setBusinessUsePercent("100")
    setDepreciationStartMonth(ym)
    setReceiptUrl("")
    setNotes("")
    setBusinessPurpose("")
    setDocumentFile(null)
    setDialogOpen(true)
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Enter an asset name.", variant: "destructive" })
      return
    }
    if (documentFile && !getGoogleDriveAccessToken()) {
      toast({
        title: "Google Drive required",
        description: "Connect Google Drive in the header to upload a purchase document.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      if (parsed.net <= 0 || parsed.life <= 0) {
        throw new Error("Enter net purchase amount and useful life (years).")
      }
      const startYmd = `${depreciationStartMonth}-01`
      const netRounded = Math.round(parsed.net * 100) / 100
      const vatRounded = Math.round(parsed.vat * 100) / 100
      const common = buildAssetCommonFields({
        category,
        purchaseDate: purchaseDate.slice(0, 10),
        amountEur: netRounded,
        purchaseVatAmountEur: vatRounded > 0 ? vatRounded : null,
        currency: currency.trim() || "EUR",
        businessPurpose: businessPurpose.trim() || null,
        notes: notes.trim() || null,
      })
      const docData: AssetDoc = {
        userId,
        category,
        name: name.trim(),
        vendor: vendor.trim(),
        businessPurpose: businessPurpose.trim() || undefined,
        purchaseDate: purchaseDate.slice(0, 10),
        purchasePriceEur: netRounded,
        vatAmountEur: Math.round(parsed.vat * 100) / 100,
        grossPriceEur: Math.round(parsed.gross * 100) / 100,
        currency: currency.trim() || "EUR",
        usefulLifeYears: parsed.life,
        depreciationMethod: method,
        depreciationSchedule: "monthly",
        depreciationStartYmd: startYmd,
        businessUsePercent: parsed.businessPct,
        annualDepreciationEur: Math.round(parsed.annual * 100) / 100,
        bookValueEur: netRounded,
        eurZeile,
        receiptUrl: receiptUrl.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      }
      const docRef = await addDoc(collection(db, "assets"), {
        ...(docData as unknown as Record<string, unknown>),
        ...common,
      })

      if (documentFile) {
        try {
          const seqNum = await fetchNextCostSequenceNumber(userId)
          const driveFile = await cloneFileForUpload(documentFile)
          const driveName = buildCostAusgabeUploadedFilename({
            billDate: purchaseDate.slice(0, 10),
            merchant: vendor.trim() || name.trim(),
            countryCode: null,
            kind: "receipt",
            originalFileName: documentFile.name,
            sequenceNumber: seqNum,
          })
          const { fileId } = await uploadFileToGoogleDrive(driveFile, driveName)
          await updateDoc(doc(db, "assets", docRef.id), {
            driveDocumentFileId: fileId,
            driveDocumentName: driveName,
          })
        } catch (driveErr) {
          console.warn(driveErr)
          toast({
            title: "Drive upload failed",
            description:
              driveErr instanceof Error
                ? `${driveErr.message} The asset was saved without the file in Drive.`
                : "The asset was saved without the file in Drive.",
            variant: "destructive",
          })
        }
      }

      toast({ title: "Asset created", description: "AfA is computed from this record in reports." })
      setDialogOpen(false)
      await load()
    } catch (e) {
      console.error(e)
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string, driveFileId?: string | null) => {
    try {
      const token = getGoogleDriveAccessToken()
      if (driveFileId && token) {
        try {
          await deleteGoogleDriveFile(driveFileId)
        } catch (e) {
          console.warn("Drive delete:", e)
        }
      }
      await deleteDoc(doc(db, "assets", id))
      toast({
        title: "Deleted",
        description:
          driveFileId && !token
            ? "Asset removed. Google Drive was not connected—the uploaded file was not deleted in Drive."
            : "Asset removed.",
      })
      await load()
    } catch (e) {
      console.error(e)
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <CardTitle className="flex items-center gap-2 flex-wrap">
            Assets & depreciation (AfA)
            <CostReportingBadge kind="afa_multi_year" />
          </CardTitle>
          <CardDescription className="text-pretty">
            Items that must be depreciated are not fully expensed in the year of purchase. You keep a purchase record and a
            depreciation schedule over useful life (e.g. laptops, monitors, furniture, some software licenses). VAT is
            tracked separately from the net AfA basis.
          </CardDescription>
        </div>
        <Button type="button" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New asset
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No assets yet. Add a purchase to start a schedule.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Net (EUR)</TableHead>
                  <TableHead className="text-right">Annual AfA (net)</TableHead>
                  <TableHead className="text-right">{calendarYear} AfA (ded.)</TableHead>
                  <TableHead>EÜR</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ id, data }) => {
                  const net = typeof data.purchasePriceEur === "number" ? data.purchasePriceEur : 0
                  const life = typeof data.usefulLifeYears === "number" ? data.usefulLifeYears : 0
                  const annual =
                    typeof data.annualDepreciationEur === "number"
                      ? data.annualDepreciationEur
                      : life > 0
                        ? net / life
                        : 0
                  const yDep = assetDepreciationForCalendarYearEur(data, calendarYear)
                  const cat = data.category as AssetCategory | undefined
                  const vendorCell = typeof data.vendor === "string" && data.vendor.trim() ? data.vendor : "—"
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{String(data.name ?? "—")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[140px] truncate">{vendorCell}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {cat ? (CAT_LABEL[cat] ?? cat) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{net.toLocaleString()} €</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {annual.toLocaleString(undefined, { maximumFractionDigits: 2 })} €
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {yDep.toLocaleString(undefined, { maximumFractionDigits: 2 })} €
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{String(data.eurZeile ?? "—")}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            void remove(id, typeof data.driveDocumentFileId === "string" ? data.driveDocumentFileId : null)
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[min(90vh,800px)] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>Create asset</DialogTitle>
                <CostReportingBadge kind="afa_multi_year" />
              </div>
            </DialogHeader>
            <div className="px-6 overflow-y-auto flex-1 space-y-6 py-2">
              <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                Depreciation spreads the <span className="font-medium text-foreground">net</span> cost over useful life.
                Input VAT is shown for your records but does not increase the AfA basis.
              </p>

              <div className="space-y-3">
                <SectionTitle>Asset basics</SectionTitle>
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="asset-name">Name</Label>
                    <Input
                      id="asset-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Office chair, MacBook Pro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as AssetCategory)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CAT_LABEL) as AssetCategory[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {CAT_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-purchase-date">Purchase date</Label>
                    <Input
                      id="asset-purchase-date"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                    <FieldHint>
                      Year and quarter for reporting metadata:{" "}
                      {(() => {
                        const yq = yearQuarterFromYmd(purchaseDate)
                        return yq ? `${yq.year} · Q${yq.quarter}` : "—"
                      })()}
                    </FieldHint>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-vendor">Vendor</Label>
                    <Input
                      id="asset-vendor"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="Supplier or shop"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase document</Label>
                    <div className="flex flex-col gap-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted/50">
                        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{documentFile ? documentFile.name : "Upload PDF or image (Google Drive)"}</span>
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,image/*"
                          onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {documentFile ? (
                        <Button type="button" variant="ghost" size="sm" className="self-start h-8" onClick={() => setDocumentFile(null)}>
                          Remove file
                        </Button>
                      ) : null}
                      <p className="text-xs text-muted-foreground">Requires Google Drive connected in the header.</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <SectionTitle>Purchase values</SectionTitle>
                <p className="text-xs text-muted-foreground">EÜR uses EUR — enter amounts already converted to EUR.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="asset-net">Net amount (EUR)</Label>
                    <Input
                      id="asset-net"
                      value={purchasePriceEur}
                      onChange={(e) => setPurchasePriceEur(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-vat">VAT (EUR)</Label>
                    <Input
                      id="asset-vat"
                      value={vatAmountEur}
                      onChange={(e) => setVatAmountEur(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Gross (EUR)</Label>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm tabular-nums">{parsed.gross.toLocaleString()} €</div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Currency (invoice)</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <SectionTitle>Depreciation setup</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="asset-life">Useful life (years)</Label>
                    <Input
                      id="asset-life"
                      value={usefulLifeYears}
                      onChange={(e) => setUsefulLifeYears(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Depreciation method</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as DepreciationMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">Linear (straight-line)</SelectItem>
                        <SelectItem value="degressiv">Declining balance (stored; reports use linear slice)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-biz">Business use (%)</Label>
                    <Input
                      id="asset-biz"
                      value={businessUsePercent}
                      onChange={(e) => setBusinessUsePercent(e.target.value)}
                      inputMode="decimal"
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="asset-start-month">AfA start month</Label>
                    <Input
                      id="asset-start-month"
                      type="month"
                      value={depreciationStartMonth}
                      onChange={(e) => setDepreciationStartMonth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>EÜR line</Label>
                    <Select value={eurZeile} onValueChange={(v) => setEurZeile(v as AssetEurZeile)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Z.44">Z.44 (e.g. hardware, furniture)</SelectItem>
                        <SelectItem value="Z.45">Z.45 (e.g. software)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <SectionTitle>Preview ({calendarYear})</SectionTitle>
                <div className="rounded-md border bg-muted/20 px-3 py-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">AfA basis (net, excl. VAT)</span>
                    <span className="tabular-nums font-medium">{parsed.net.toLocaleString(undefined, { maximumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">VAT (separate)</span>
                    <span className="tabular-nums">{parsed.vat.toLocaleString(undefined, { maximumFractionDigits: 2 })} €</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Straight-line per full year (net ÷ life)</span>
                    <span className="tabular-nums">{parsed.annual.toLocaleString(undefined, { maximumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Deductible AfA, {calendarYear}</span>
                    <span className="tabular-nums font-medium">{previewYtd.toLocaleString(undefined, { maximumFractionDigits: 2 })} €</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Remaining net book value (end {calendarYear})</span>
                    <span className="tabular-nums">{previewRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })} €</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Deductible AfA applies business-use %. Restbuchwert uses full net depreciation. Yearly AfA is computed in
                    reports from this record (no separate journal entries stored).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <SectionTitle>Notes (optional)</SectionTitle>
                <div className="space-y-2">
                  <Label htmlFor="asset-biz-purpose">Business purpose (optional)</Label>
                  <Textarea
                    id="asset-biz-purpose"
                    value={businessPurpose}
                    onChange={(e) => setBusinessPurpose(e.target.value)}
                    placeholder="Why this asset is needed for your business"
                    rows={2}
                  />
                  <FieldHint>Purchase is recorded now; the expense is spread over years via AfA.</FieldHint>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-url">Link to document (optional)</Label>
                  <Input
                    id="asset-url"
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-notes">Notes</Label>
                  <Input id="asset-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal note" />
                </div>
              </div>
            </div>
            <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
