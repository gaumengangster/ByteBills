"use client"

import { useCallback, useEffect, useState } from "react"
import { collection, deleteDoc, doc, getDocs, limit, query, where } from "firebase/firestore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import type { CostItem, CostItemType } from "@/lib/cost-item-types"
import { collectionForType, VAT_CODE_OPTIONS, VENDOR_ORIGIN_OPTIONS } from "@/lib/cost-item-types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, MoreHorizontal, RefreshCw, Trash2, Upload } from "lucide-react"
import { deleteGoogleDriveFile, getGoogleDriveAccessToken } from "@/lib/google-drive-upload-client"
import { driveDeleteOrphanWarning } from "@/lib/google-drive-delete-warning"
import { costItemNeedsFxSync, costItemSupportsFxConversion, syncCostItemFx } from "@/lib/sync-cost-item-fx"

function typeLabel(t: CostItemType): string {
  switch (t) {
    case "cost_invoice": return "Invoice"
    case "cost_partial_business_use": return "Partial"
    case "cost_pauschale": return "Pauschale"
    case "cost_afa": return "AfA"
    case "cost_afa_multiyear_slice": return "AfA yr"
    default: return t
  }
}

function typeBadgeVariant(t: CostItemType): "default" | "secondary" | "outline" {
  if (t === "cost_invoice") return "default"
  if (t === "cost_afa" || t === "cost_afa_multiyear_slice") return "outline"
  return "secondary"
}

function calendarQuarterLabel(item: CostItem): string | null {
  if (typeof item.costQuarter === "number" && item.costQuarter >= 1 && item.costQuarter <= 4) {
    return `Q${item.costQuarter}`
  }
  if (item.quartal === "q1") return "Q1"
  if (item.quartal === "q2") return "Q2"
  if (item.quartal === "q3") return "Q3"
  if (item.quartal === "q4") return "Q4"
  return null
}

function reportingBadge(item: CostItem): string | null {
  const year = item.costYear ?? item.euerYear
  const qLabel = calendarQuarterLabel(item)
  if (item.includeInVatQuarter && item.vatQuarter) {
    return `VAT ${item.vatQuarter} ${item.vatYear ?? year ?? ""}`
  }
  if (item.includeInAnnualEuer && year) {
    return qLabel ? `EÜR ${year} · ${qLabel}` : `EÜR ${year}`
  }
  if (year) return qLabel ? `${year} · ${qLabel}` : String(year)
  return null
}

function fmtAmount(n: number | undefined | null, currency: string = "EUR"): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${currency || "EUR"} ${n.toFixed(2)}`
  }
}

function finiteNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

type AmountCell = { main: string; original?: string }

function displayAmount(
  eur: number | undefined,
  original: number | undefined,
  itemCurrency: string,
): AmountCell {
  const cur = (itemCurrency || "EUR").trim().toUpperCase()
  if (cur !== "EUR" && eur != null) {
    return {
      main: fmtAmount(eur, "EUR"),
      original: original != null ? fmtAmount(original, cur) : undefined,
    }
  }
  const value = original ?? eur
  return { main: fmtAmount(value, cur === "EUR" ? "EUR" : cur) }
}

function amountCells(item: CostItem): { net: AmountCell; vat: AmountCell; gross: AmountCell } {
  if (item.type === "cost_afa_multiyear_slice") {
    return {
      net: { main: fmtAmount(item.amountNet, "EUR") },
      vat: { main: "—" },
      gross: { main: "—" },
    }
  }

  const currency = item.currency || "EUR"

  if (item.type === "cost_partial_business_use") {
    const grossOriginal =
      finiteNum(item.deductibleGrossAmount) ??
      (finiteNum(item.deductibleNetAmount) != null && finiteNum(item.deductibleVatAmount) != null
        ? item.deductibleNetAmount + item.deductibleVatAmount
        : undefined)
    const grossEur =
      finiteNum(item.deductibleGrossAmountEur) ??
      (finiteNum(item.deductibleNetAmountEur) != null && finiteNum(item.deductibleVatAmountEur) != null
        ? Math.round((item.deductibleNetAmountEur + item.deductibleVatAmountEur) * 100) / 100
        : undefined)
    return {
      net: displayAmount(finiteNum(item.deductibleNetAmountEur), finiteNum(item.deductibleNetAmount), currency),
      vat: displayAmount(finiteNum(item.deductibleVatAmountEur), finiteNum(item.deductibleVatAmount), currency),
      gross: displayAmount(grossEur, grossOriginal, currency),
    }
  }

  const grossOriginal =
    finiteNum(item.amountGross) ??
    (finiteNum(item.amountNet) != null && finiteNum(item.amountVat) != null
      ? item.amountNet + item.amountVat
      : undefined)
  const grossEur =
    finiteNum(item.amountGrossEur) ??
    (finiteNum(item.amountNetEur) != null && finiteNum(item.amountVatEur) != null
      ? Math.round((item.amountNetEur + item.amountVatEur) * 100) / 100
      : undefined)

  return {
    net: displayAmount(finiteNum(item.amountNetEur), finiteNum(item.amountNet), currency),
    vat: displayAmount(finiteNum(item.amountVatEur), finiteNum(item.amountVat), currency),
    gross: displayAmount(grossEur, grossOriginal, currency),
  }
}

function AmountTableCell({
  cell,
  className,
}: {
  cell: AmountCell
  className?: string
}) {
  return (
    <div className={`flex flex-col items-end gap-0.5 ${className ?? ""}`}>
      <span>{cell.main}</span>
      {cell.original ? (
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">{cell.original}</span>
      ) : null}
    </div>
  )
}

function fmtDate(ymd: string): string {
  try { return format(new Date(ymd), "dd.MM.yyyy") } catch { return ymd }
}

/** Extract all Google Drive file IDs from a cost item's documents array. */
function driveFileIdsFromItem(item: CostItem): string[] {
  const docs = item.documents ?? []
  const ids: string[] = []
  for (const d of docs) {
    // id is the Drive file ID when saved via the wizard or upload-document page
    if (d.id && d.fileUrl?.includes("drive.google.com")) {
      ids.push(d.id)
    }
  }
  return ids
}

export function CostRegisterTab({
  userId,
  refreshKey,
}: {
  userId: string
  refreshKey?: number
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Array<{ id: string; collectionName: string; data: CostItem }>>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; collectionName: string; data: CostItem } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [convertingFxId, setConvertingFxId] = useState<string | null>(null)

  const COST_COLLECTIONS: CostItemType[] = [
    "cost_invoice",
    "cost_partial_business_use",
    "cost_pauschale",
    "cost_afa",
    "cost_afa_multiyear_slice",
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snapshots = await Promise.all(
        COST_COLLECTIONS.map((t) =>
          getDocs(query(collection(db, collectionForType(t)), where("userId", "==", userId), limit(300))),
        ),
      )
      const list: Array<{ id: string; collectionName: string; data: CostItem }> = []
      snapshots.forEach((snap, i) => {
        const colName = collectionForType(COST_COLLECTIONS[i])
        snap.docs.forEach((d) => list.push({ id: d.id, collectionName: colName, data: d.data() as CostItem }))
      })
      list.sort((a, b) =>
        String(b.data.expenseDate ?? "").localeCompare(String(a.data.expenseDate ?? "")),
      )
      setRows(list)
    } catch (e) {
      console.error(e)
      toast({
        title: "Could not load costs",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load, refreshKey])

  const handleConvertToEur = async (row: { id: string; collectionName: string; data: CostItem }) => {
    setConvertingFxId(row.id)
    try {
      const result = await syncCostItemFx({
        db,
        userId,
        collectionName: row.collectionName,
        docId: row.id,
        force: true,
      })
      if (!result.ok) {
        if (result.reason === "not_applicable") {
          toast({
            title: "Already in EUR",
            description: "This cost is recorded in EUR — no conversion needed.",
          })
        } else if (result.reason === "missing_fx") {
          toast({
            title: "Missing exchange rate",
            description:
              "Import the BMF CSV for this expense month on Exchange rates, then try again.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Conversion failed",
            description: "Could not compute EUR amounts for this cost.",
            variant: "destructive",
          })
        }
        return
      }
      if (result.skipped) {
        toast({
          title: "Already converted",
          description: "EUR amounts are already set for this cost.",
        })
        return
      }
      toast({
        title: "Converted to EUR",
        description:
          result.amountNetEur != null && result.eurRate != null
            ? `Net €${result.amountNetEur.toFixed(2)} (1 EUR = ${result.eurRate.toFixed(4)} ${row.data.currency})`
            : "EUR amounts were updated from BMF rates.",
      })
      await load()
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Conversion failed unexpectedly.",
        variant: "destructive",
      })
    } finally {
      setConvertingFxId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Delete linked Google Drive files (best-effort — don't block Firestore delete on failure)
      const driveFileIds = driveFileIdsFromItem(deleteTarget.data)
      if (driveFileIds.length > 0 && getGoogleDriveAccessToken()) {
        await Promise.allSettled(driveFileIds.map((fid) => deleteGoogleDriveFile(fid)))
      }

      await deleteDoc(doc(db, deleteTarget.collectionName, deleteTarget.id))
      toast({ title: "Deleted", description: "Cost item and linked Drive files removed." })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Cost register</CardTitle>
          <CardDescription>
            All expenses added via <strong className="font-medium text-foreground">Add cost</strong>. Amounts show
            in EUR when converted; otherwise in the original currency. Partial costs show the deductible portion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground space-y-1">
              <p>No cost items yet.</p>
              <p>Click <strong className="font-medium text-foreground">Add cost</strong> above to record your first expense.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title / vendor</TableHead>
                  <TableHead>Reporting</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ id, collectionName, data: r }) => {
                  const badge = reportingBadge(r)
                  return (
                    <TableRow key={id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span>{r.expenseDate ? fmtDate(r.expenseDate) : "—"}</span>
                          {costItemNeedsFxSync(r as unknown as Record<string, unknown>) ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                              nonEUR
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={typeBadgeVariant(r.type)} className="text-[11px] w-fit">
                            {typeLabel(r.type)}
                          </Badge>
                          {r.vendorOrigin && (
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              {VENDOR_ORIGIN_OPTIONS.find((o) => o.value === r.vendorOrigin)?.label ?? r.vendorOrigin}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm leading-tight">{r.title || "—"}</p>
                          {r.documentStatus === "pending" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Document needed
                            </Badge>
                          )}
                          {r.recurringGroupId && r.recurringMonthIndex != null && r.recurringMonthIndex > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              Month +{r.recurringMonthIndex}
                            </Badge>
                          )}
                        </div>
                        {r.vendorName ? (
                          <p className="text-xs text-muted-foreground leading-tight">{r.vendorName}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {badge ? (
                          <Badge variant="outline" className="text-[10px]">
                            {badge}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {(() => {
                        const { net, vat, gross } = amountCells(r)
                        const vatLabel = r.vatCode
                          ? (VAT_CODE_OPTIONS.find((o) => o.value === r.vatCode)?.label.split("–")[0].trim() ?? r.vatCode)
                          : null
                        return (
                          <>
                            <TableCell className="text-right tabular-nums text-sm">
                              <AmountTableCell cell={net} />
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              <div className="flex flex-col items-end gap-0.5">
                                <AmountTableCell cell={vat} />
                                {vatLabel && (
                                  <span className="text-[10px] text-muted-foreground/70 font-mono">{vatLabel}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-medium">
                              <AmountTableCell cell={gross} />
                            </TableCell>
                          </>
                        )
                      })()}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.documentStatus === "pending" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() =>
                                router.push(
                                  `/costs/${encodeURIComponent(collectionName)}/${id}/upload-document`,
                                )
                              }
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Upload
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              {costItemSupportsFxConversion(r as unknown as Record<string, unknown>) ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    void handleConvertToEur({ id, collectionName, data: r })
                                  }
                                  disabled={convertingFxId === id}
                                >
                                  {convertingFxId === id ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Converting…
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      {costItemNeedsFxSync(r as unknown as Record<string, unknown>)
                                        ? "Convert to EUR"
                                        : "Refresh EUR conversion"}
                                    </>
                                  )}
                                </DropdownMenuItem>
                              ) : null}
                              {r.documentStatus === "pending" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/costs/${encodeURIComponent(collectionName)}/${id}/upload-document`,
                                    )
                                  }
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload document
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget({ id, collectionName, data: r })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cost item?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>The record will be permanently removed from your register.</p>
                {deleteTarget && (() => {
                  const fileIds = driveFileIdsFromItem(deleteTarget.data)
                  if (fileIds.length === 0) return null
                  const warning = driveDeleteOrphanWarning(true)
                  if (warning) {
                    return (
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠ {warning}
                      </p>
                    )
                  }
                  return (
                    <p>
                      {fileIds.length} linked {fileIds.length === 1 ? "file" : "files"} will also be deleted from Google Drive.
                    </p>
                  )
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
