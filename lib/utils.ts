import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const formatCurrency = (amount: number, invoice:any) => {
    const currency = invoice?.currency || "CZK"
    const currencyMap: { [key: string]: string } = {
      CZK: "CZK",
      EUR: "EUR",
      USD: "USD",
      GBP: "GBP",
      JPY: "JPY",
      AUD: "AUD",
      CAD: "CAD",
      CHF: "CHF",
      CNY: "CNY",
      INR: "INR",
      MXN: "MXN",
      UGX: "UGX",
    }
    const result = new Intl.NumberFormat("cz-CZ", {
      style: "currency",
      currency: currencyMap[currency] || "CZK",
    }).format(amount)
    return result
  }
