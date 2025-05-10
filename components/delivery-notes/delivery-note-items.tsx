"use client"

import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField, FormControl, FormItem, FormMessage } from "@/components/ui/form"
import { Plus, Minus } from "lucide-react"
import { useFieldArray } from "react-hook-form"

type DeliveryNoteItemsProps = {
  form: UseFormReturn<any>
}

export function DeliveryNoteItems({ form }: DeliveryNoteItemsProps) {
  const { fields, append, remove } = useFieldArray({
    name: "items",
    control: form.control,
  })

  const addItem = () => {
    append({ description: "", quantity: 1, notes: "" })
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-4 p-4 font-medium border-b">
          <div className="col-span-6">Description</div>
          <div className="col-span-2 text-center">Quantity</div>
          <div className="col-span-3">Notes</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-4 p-4 items-center">
              <div className="col-span-6">
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
                  name={`items.${index}.notes`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Item notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
      </div>
    </div>
  )
}
