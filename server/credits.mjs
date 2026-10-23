// Prints your KudiSMS balance. PowerShell:  $env:KUDISMS_TOKEN="your-token"; npm run credits
import { readConfig, smsBalance } from './notify.mjs'

const cfg = readConfig()
if (!cfg.kudiToken) { console.error('Set KUDISMS_TOKEN first.'); process.exit(1) }
console.log(await smsBalance(cfg))
