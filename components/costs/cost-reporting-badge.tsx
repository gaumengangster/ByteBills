"use client"

import type { ReactNode } from "react"
import type { CostReportingKind } from "@/lib/cost-common-fields"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function CostReportingBadge({ kind }: { kind: CostReportingKind }) {
  if (kind === "vat_quarterly") {
    return <Badge variant="default">VAT return relevant</Badge>
  }
  if (kind === "year_end") {
    return <Badge variant="secondary">Year-end only</Badge>
  }
  return <Badge variant="outline">Multi-year (AfA)</Badge>
}

export function FieldHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs text-muted-foreground mt-1.5 leading-snug", className)}>{children}</p>
}
