'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export const CURRENCIES = [
  { code: 'ETB', symbol: 'ETB', name: 'Ethiopian Birr' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

// Base currency is ETB. Rates as of 2026-05-03.
// 1 ETB = X foreign currency. Replace with live API later.
const ETB_TO_FOREIGN: Record<CurrencyCode, number> = {
  ETB: 1,
  USD: 0.0074,   // 1 ETB ≈ 0.0074 USD  (1 USD ≈ 135 ETB)
  EUR: 0.0066,   // 1 ETB ≈ 0.0066 EUR  (1 EUR ≈ 152 ETB)
  GBP: 0.0056,   // 1 ETB ≈ 0.0056 GBP  (1 GBP ≈ 179 ETB)
  AED: 0.0272,   // 1 ETB ≈ 0.0272 AED  (1 AED ≈ 36.8 ETB)
  CNY: 0.054,    // 1 ETB ≈ 0.054 CNY   (1 CNY ≈ 18.5 ETB)
  KES: 0.96,     // 1 ETB ≈ 0.96 KES    (1 KES ≈ 1.04 ETB)
}

interface CurrencyContextType {
  currency: CurrencyCode
  setCurrency: (code: CurrencyCode) => void
  formatBudget: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>('ETB')

  const formatBudget = (amountInEtb: number) => {
    const curr = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
    const converted = amountInEtb * ETB_TO_FOREIGN[currency]
    const prefix = curr.symbol
    if (converted >= 1_000_000) return `${prefix} ${(converted / 1_000_000).toFixed(1)}M`
    if (converted >= 1_000) return `${prefix} ${(converted / 1_000).toFixed(1)}K`
    return `${prefix} ${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatBudget }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider')
  return context
}
