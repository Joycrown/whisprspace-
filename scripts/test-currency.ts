
import { convertPrice, formatCurrency } from '../lib/payments/currency'

console.log('--- Testing Currency Conversion ---')

const testCases = [
  { amount: 10, currency: 'USD', expected: 10 },
  { amount: 10, currency: 'NGN', expected: 15000 },
  { amount: 1, currency: 'KES', expected: 160 },
  { amount: 5, currency: 'GHS', expected: 78 }, // 5 * 15.5 = 77.5 -> ceil -> 78
]

testCases.forEach(({ amount, currency, expected }) => {
  const result = convertPrice(amount, currency as any)
  const passed = result === expected
  console.log(
    `[${passed ? 'PASS' : 'FAIL'}] ${amount} USD -> ${currency}: ${result} (Expected: ${expected})`
  )
  console.log(`Formatted: ${formatCurrency(result, currency as any)}`)
})

console.log('--- End Test ---')
