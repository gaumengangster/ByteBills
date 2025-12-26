"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Percent } from "lucide-react"

type TaxSelectorStateProps = {
  value: number
  onChange: (taxPercentage: number) => void
}

export function TaxSelectorState({ value, onChange }: TaxSelectorStateProps) {
  return (
    <div className="space-y-2">
      <Label>Tax Percentage (%)</Label>
      <div className="relative">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="0.00"
          className="pr-8"
          value={value}
          onChange={(e) => {
            const numValue = Number.parseFloat(e.target.value)
            onChange(isNaN(numValue) ? 0 : numValue)
          }}
        />
        <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  )
}
