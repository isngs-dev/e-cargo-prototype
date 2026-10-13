import type { Customer, DocumentKind, RegistrationApplication } from '@/types/domain'

/** Automated validation checks shown to the District Supervisor (baseline §3.2). */
export interface RegistrationCheck {
  key: 'duplicate_cac' | 'blacklisted' | 'incomplete_docs'
  label: string
  passed: boolean
  detail: string
}

export function requiredRegistrationDocs(taxCertificateRequired: boolean): DocumentKind[] {
  return taxCertificateRequired
    ? ['cac_certificate', 'company_profile', 'tax_certificate']
    : ['cac_certificate', 'company_profile']
}

const normaliseCac = (cac: string) => cac.replace(/[^0-9a-z]/gi, '').toUpperCase()

export function runRegistrationChecks(
  app: RegistrationApplication,
  customers: Customer[],
  applications: RegistrationApplication[],
  taxCertificateRequired: boolean,
): RegistrationCheck[] {
  const cac = normaliseCac(app.cacNumber)
  const dupCustomer = customers.find((c) => normaliseCac(c.cacNumber) === cac && c.id !== app.customerId)
  const dupApp = applications.find(
    (a) => a.id !== app.id && normaliseCac(a.cacNumber) === cac && a.status !== 'rejected' && a.status !== 'activated',
  )
  const blacklisted = customers.find((c) => normaliseCac(c.cacNumber) === cac && c.accountStatus === 'blacklisted')
  const missing = requiredRegistrationDocs(taxCertificateRequired).filter(
    (k) => !app.documents.some((d) => d.kind === k),
  )

  return [
    {
      key: 'duplicate_cac',
      label: 'Duplicate CAC detection',
      passed: !dupCustomer && !dupApp,
      detail: dupCustomer
        ? `CAC already registered to ${dupCustomer.companyName}.`
        : dupApp
          ? `CAC also used on open application ${dupApp.reference}.`
          : 'No other customer or open application uses this CAC number.',
    },
    {
      key: 'blacklisted',
      label: 'Blacklisted customer check',
      passed: !blacklisted,
      detail: blacklisted ? `CAC matches blacklisted customer ${blacklisted.companyName}.` : 'Not on the demo blacklist.',
    },
    {
      key: 'incomplete_docs',
      label: 'Incomplete documentation check',
      passed: missing.length === 0,
      detail: missing.length ? `Missing: ${missing.map((k) => documentLabels[k]).join(', ')}.` : 'All required documents uploaded.',
    },
  ]
}

export const documentLabels: Record<DocumentKind, string> = {
  cac_certificate: 'CAC Certificate',
  company_profile: 'Company Profile',
  tax_certificate: 'Tax Certificate',
  bill_of_lading: 'Bill of Lading',
  packing_list: 'Packing List',
  invoice: 'Invoice',
  radiation_certificate: 'Radiation Certificate',
  customs_clearance: 'Customs Clearance',
  hazardous_compliance: 'Hazardous Compliance Document',
}
