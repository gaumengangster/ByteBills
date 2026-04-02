"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const CURRENCIES = [
    // 🇺🇬 Uganda
    { code: "UGX", symbol: "Sh", name: "Ugandan Shilling" },
  
    // 🇰🇪 Kenya
    { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  
    // 🇹🇿 Tanzania
    { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
  
    // 🇷🇼 Rwanda
    { code: "RWF", symbol: "RF", name: "Rwandan Franc" },
  
    // 🇧🇮 Burundi
    { code: "BIF", symbol: "FBu", name: "Burundian Franc" },
  
    // 🇸🇸 South Sudan
    { code: "SSP", symbol: "SSP", name: "South Sudanese Pound" },
  
    // 🇪🇹 Ethiopia
    { code: "ETB", symbol: "Br", name: "Ethiopian Birr" },
  
    // 🇸🇴 Somalia
    { code: "SOS", symbol: "Sh", name: "Somali Shilling" },
  
    // 🇪🇷 Eritrea
    { code: "ERN", symbol: "Nfk", name: "Eritrean Nakfa" },
  
    // 🇩🇯 Djibouti
    { code: "DJF", symbol: "Fdj", name: "Djiboutian Franc" },
  
    // 🌍 Common International Currencies
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "MXN", symbol: "$", name: "Mexican Peso" },
  ];  

type CurrencySelectorStateProps = {
  value: string
  onChange: (currency: string) => void
}

export function CurrencySelectorState({ value, onChange }: CurrencySelectorStateProps) {
  return (
    <div className="space-y-2">
      <Label>Currency</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select currency" />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              {currency.code} - {currency.name} ({currency.symbol})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
