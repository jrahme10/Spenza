import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../src/App.tsx', import.meta.url)
let source = readFileSync(path, 'utf8')

const target = `   <div className="accountSummary homeAvailableAmount"><span>Available Amount</span><strong>{homeWallet?money(homeAvailable,homeWallet.currency):'—'}</strong></div>\n`

if (source.includes(target)) {
  source = source.replace(target, '')
  writeFileSync(path, source)
  console.log('Removed Home Available Amount section')
} else if (source.includes('className="accountSummary homeAvailableAmount"')) {
  throw new Error('Available Amount section found but did not match expected markup')
} else {
  console.log('Home Available Amount section already removed')
}
