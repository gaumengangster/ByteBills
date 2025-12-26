"use client"

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { UseFormReturn } from "react-hook-form"
import { Percent } from "lucide-react"

type TaxSelectorProps = {
  form: UseFormReturn<any>
  fieldName?: string
}

export function TaxSelector({ form, fieldName = "taxPercentage" }: TaxSelectorProps) {
  return (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tax Percentage (%)</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                className="pr-8"
                {...field}
                onChange={(e) => {
                  const value = Number.parseFloat(e.target.value)
                  field.onChange(isNaN(value) ? 0 : value)
                }}
              />
              <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
