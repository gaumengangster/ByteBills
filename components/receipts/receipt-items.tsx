"use client"

import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField, FormControl, FormItem, FormMessage } from "@/components/ui/form"
import { Plus, Minus, DollarSign } from "lucide-react"
import { useFieldArray } from "react-hook-form"

type ReceiptItemsProps = {
  form: UseFormReturn<any>
}

export function ReceiptItems({ form }: ReceiptItemsProps) {
  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  })

  const addItem = () => {
    append({ description: "", quantity: 1, unitPrice: 0 })
  }

  const calculateSubtotal = () => {
    const items = form.getValues("items") || []
    return items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      return sum + quantity * unitPrice
    }, 0)
  }

  const calculateTax = () => {
    return calculateSubtotal() * 0.1 // 10% tax rate example
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-4 p-4 font-medium border-b">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-center">Quantity</div>
          <div className="col-span-3 text-center">Unit Price</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>

        <div className="divide-y">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-4 p-4 items-center">
              <div className="col-span-5">
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Item description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          className="text-center"
                          {...field}
                          onChange={(e) => {
                            const value = Number.parseInt(e.target.value)
                            field.onChange(isNaN(value) ? 0 : value)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`items.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="pl-8 text-right"
                            {...field}
                            onChange={(e) => {
                              const value = Number.parseFloat(e.target.value)
                              field.onChange(isNaN(value) ? 0 : value)
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-1 text-right">
                {formatCurrency(
                  (form.getValues(`items.${index}.quantity`) || 0) * (form.getValues(`items.${index}.unitPrice`) || 0),
                )}
              </div>

              <div className="col-span-1 flex justify-end">
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Minus className="h-4 w-4" />
                    <span className="sr-only">Remove item</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>

        <div className="space-y-2 min-w-[200px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{formatCurrency(calculateSubtotal())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (10%):</span>
            <span>{formatCurrency(calculateTax())}</span>
          </div>
          <div className="flex justify-between font-medium pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
