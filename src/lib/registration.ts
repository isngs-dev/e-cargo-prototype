import type { Customer, DocumentKind, District, ModeOfOperation, RegistrationApplication, ServiceProvided } from '@/types/domain'

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

/** Form values. `district` is empty until the facilitator chooses one (required before submission). */
export type RegistrationInput = Pick<
  RegistrationApplication,
  'companyName' | 'cacNumber' | 'registeredAddress' | 'modes' | 'services' | 'poc' | 'documents'
> & { district: District | '' }

export const allModes: ModeOfOperation[] = ['Containerized', 'Non-Containerized']
export const allServices: ServiceProvided[] = ['Clearance', 'Loading/Offloading', 'Documentation', 'Multi-modal']
export const countryCodes = ['+234', '+233', '+229', '+228', '+225', '+27', '+44', '+1']

/** CAC format is a demo assumption (A-10): RC / BN / IT followed by digits. */
export const CAC_PATTERN = /^(RC|BN|IT)\s?\d{4,8}$/i

export type RegistrationErrors = Partial<Record<
  'companyName' | 'registeredAddress' | 'district' | 'cacNumber' | 'modes' | 'services' | 'pocName' | 'pocEmail' | 'pocPhone' | 'documents',
  string
>>

export function validateRegistration(v: RegistrationInput, taxCertificateRequired: boolean): RegistrationErrors {
  const e: RegistrationErrors = {}
  if (v.companyName.trim().length < 2) e.companyName = 'Enter the company name.'
  if (v.registeredAddress.trim().length < 5) e.registeredAddress = 'Enter the registered address.'
  if (!v.district) e.district = 'Select the district you operate in.'
  if (!v.cacNumber.trim()) e.cacNumber = 'Enter the CAC number.'
  else if (!CAC_PATTERN.test(v.cacNumber.trim())) e.cacNumber = 'CAC number should look like RC 1234567 (RC, BN or IT followed by digits).'
  if (v.modes.length === 0) e.modes = 'Select at least one mode of operation.'
  if (v.services.length === 0) e.services = 'Select at least one service provided.'
  if (v.poc.name.trim().length < 2) e.pocName = 'Enter the point of contact’s name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.poc.email.trim())) e.pocEmail = 'Enter a valid email address.'
  const digits = v.poc.phone.replace(/[\s-]/g, '')
  if (!/^\d{7,12}$/.test(digits)) e.pocPhone = 'Enter 7–12 digits (without the country code).'
  const missing = requiredRegistrationDocs(taxCertificateRequired).filter((k) => !v.documents.some((d) => d.kind === k))
  if (missing.length) e.documents = `Upload: ${missing.map((k) => documentLabels[k]).join(', ')}.`
  return e
}
