// Prints your KudiSMS balance. PowerShell:  $env:KUDISMS_TOKEN="your-token"; npm run credits
import { nbsBalance, readConfig, smsBalance } from './notify.mjs'

const cfg = readConfig()
if (cfg.nbsUser && cfg.nbsPassword) console.log('Nigeria Bulk SMS:', await nbsBalance(cfg))
else if (cfg.kudiToken) console.log('KudiSMS:', await smsBalance(cfg))
else { console.error('Set NBS_USERNAME and NBS_PASSWORD, or KUDISMS_TOKEN, first.'); process.exit(1) }
