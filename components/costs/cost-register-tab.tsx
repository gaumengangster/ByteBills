"use client"

import { useCallback, useEffect, useState } from "react"
import { collection, deleteDoc, doc, getDocs, limit, query, where } from "firebase/firestore"
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
import { Loader2, Trash2, Upload } from "lucide-react"
import { deleteGoogleDriveFile, getGoogleDriveAccessToken } from "@/lib/google-drive-upload-client"
import { driveDeleteOrphanWarning } from "@/lib/google-drive-delete-warning"

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

function reportingBadge(item: CostItem): string | null {
  if (item.includeInVatQuarter && item.vatQuarter) return `VAT ${item.vatQuarter} ${item.vatYear ?? ""}`
  if (!item.includeInVatQuarter && item.includeInAnnualEuer) return `EÜR ${item.euerYear}`
  if (item.includeInAnnualEuer) return `EÜR ${item.euerYear}`
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

function amountCells(item: CostItem): { net: string; vat: string; gross: string } {
  if (item.type === "cost_afa_multiyear_slice") {
    return { net: fmtAmount(item.amountNet, "EUR"), vat: "—", gross: "—" }
  }
  const currency = item.currency || "EUR"
  if (item.type === "cost_partial_business_use") {
    // Show deductible amounts (the business-use portion)
    return {
      net: fmtAmount(item.deductibleNetAmount, currency),
      vat: fmtAmount(item.deductibleVatAmount, currency),
      gross: fmtAmount(item.deductibleGrossAmount, currency),
    }
  }
  return {
    net: fmtAmount(item.amountNet, currency),
    vat: fmtAmount(item.amountVat, currency),
    gross: fmtAmount(item.amountGross ?? (
      typeof item.amountNet === "number" && typeof item.amountVat === "number"
        ? item.amountNet + item.amountVat
        : undefined
    ), currency),
  }
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
            All expenses added via <strong className="font-medium text-foreground">Add cost</strong>. Each
            item has the full type, reporting flags, and attached documents.
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
                        {r.expenseDate ? fmtDate(r.expenseDate) : "—"}
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
                            <TableCell className="text-right tabular-nums text-sm">{net}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                              <div className="flex flex-col items-end gap-0.5">
                                <span>{vat}</span>
                                {vatLabel && (
                                  <span className="text-[10px] text-muted-foreground/70 font-mono">{vatLabel}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-medium">{gross}</TableCell>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteTarget({ id, collectionName, data: r })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
