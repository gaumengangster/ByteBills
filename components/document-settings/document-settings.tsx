"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { UseFormReturn } from "react-hook-form"
import { CurrencySelector } from "./currency-selector"
import { TaxSelector } from "./tax-selector"
import { CurrencySelectorState } from "./currency-selector-state"
import { TaxSelectorState } from "./tax-selector-state"

type DocumentSettingsProps = {
  // Form-based props (for use with React Hook Form)
  form?: UseFormReturn<any>
  // State-based props (for use with local state)
  currency?: string
  onCurrencyChange?: (currency: string) => void
  taxPercentage?: number
  onTaxPercentageChange?: (taxPercentage: number) => void
  // Display options
  showCurrency?: boolean
  showTax?: boolean
  hidesTaxSelector?: boolean
}

export function DocumentSettings({
  form,
  currency,
  onCurrencyChange,
  taxPercentage,
  onTaxPercentageChange,
  showCurrency = true,
  showTax = true,
  hidesTaxSelector,
}: DocumentSettingsProps) {
  const isFormBased = !!form
  const isStateBased = !!currency && !!onCurrencyChange

  // Use hidesTaxSelector to conditionally hide tax selector for delivery notes
  const effectiveShowTax = hidesTaxSelector ? false : showTax

  // If no valid props provided, return null
  if (!isFormBased && !isStateBased) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <h3 className="text-lg font-medium">Document Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showCurrency &&
            (isFormBased ? (
              <CurrencySelector form={form!} fieldName="currency" />
            ) : (
              <CurrencySelectorState value={currency!} onChange={onCurrencyChange!} />
            ))}

          {effectiveShowTax &&
            taxPercentage !== undefined &&
            (isFormBased ? (
              <TaxSelector form={form!} fieldName="taxPercentage" />
            ) : (
              <TaxSelectorState value={taxPercentage} onChange={onTaxPercentageChange!} />
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
