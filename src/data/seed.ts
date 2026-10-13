/**
 * Seeded DEMONSTRATION data. Companies, people, CAC numbers, rates and amounts are fictional.
 * Freight rates are illustrative only and are not NRC tariffs.
 */
import type {
  AuditEntry,
  Booking,
  BookingStatus,
  CargoType,
  ContainerLine,
  Customer,
  CustomerEligibility,
  DocumentKind,
  EntityType,
  FreightRate,
  PaymentException,
  PaymentTerms,
  PlatformConfig,
  Refund,
  RegistrationApplication,
  RegistrationStatus,
  Role,
  Route,
  StaffAccount,
  UploadedDocument,
} from '@/types/domain'
import { naira } from '@/lib/money'
import { calculatePrice } from '@/lib/pricing'
import { indicativeDiscountBp } from '@/lib/eligibility'
import { demoVerificationRef, formatAwbNumber } from '@/lib/awb'

export const SEED_VERSION = 3

export const config: PlatformConfig = {
  tax: { vatBp: 750, stampDutyBp: 75, insuranceBp: 150, basis: 'net' },
  paymentWindowHours: 72,
  paymentReminderHours: 24,
  refundWindowDays: 30,
  taxCertificateRequired: false,
}

export const routes: Route[] = [
  { id: 'rt-apl', code: 'APP-APL', origin: 'Apapa Port', destination: 'Apapa Local', distanceKm: 6, active: true },
  { id: 'rt-ebm', code: 'APP-EBM', origin: 'Apapa Port', destination: 'Ebute Metta', distanceKm: 14, active: true },
  { id: 'rt-mny', code: 'APP-MNY', origin: 'Apapa Port', destination: 'Moniya (Ibadan)', distanceKm: 156, active: true },
]

const rate = (id: string, routeId: string, cargoType: CargoType, containerType: FreightRate['containerType'], n: number, effectiveFrom = '2026-01-01'): FreightRate => ({
  id, routeId, cargoType, containerType, ratePerUnit: naira(n), effectiveFrom,
})

export const freightRates: FreightRate[] = [
  rate('fr-apl-20', 'rt-apl', 'Containerized', '20ft', 45_000),
  rate('fr-apl-40', 'rt-apl', 'Containerized', '40ft', 75_000),
  rate('fr-apl-rf', 'rt-apl', 'Containerized', 'Reefer', 95_000),
  rate('fr-apl-wg', 'rt-apl', 'Non-Containerized', 'Wagon', 60_000),
  rate('fr-ebm-20-old', 'rt-ebm', 'Containerized', '20ft', 85_000, '2025-07-01'), // superseded row, kept for history
  rate('fr-ebm-20', 'rt-ebm', 'Containerized', '20ft', 90_000),
  rate('fr-ebm-40', 'rt-ebm', 'Containerized', '40ft', 150_000),
  rate('fr-ebm-rf', 'rt-ebm', 'Containerized', 'Reefer', 180_000),
  rate('fr-ebm-wg', 'rt-ebm', 'Non-Containerized', 'Wagon', 110_000),
  rate('fr-mny-20', 'rt-mny', 'Containerized', '20ft', 320_000),
  rate('fr-mny-40', 'rt-mny', 'Containerized', '40ft', 520_000),
  rate('fr-mny-rf', 'rt-mny', 'Containerized', 'Reefer', 610_000),
  // Intentionally NO Non-Containerized rate on APP-MNY: demonstrates that unpriceable bookings are blocked (open item #5).
]

export const staff: StaffAccount[] = [
  { id: 'st-ds', name: 'Chukwuemeka Obi', email: 'c.obi@nrc.demo', role: 'district_supervisor', district: 'Lagos', status: 'active', lastLoginAt: '2026-10-13T08:12:00+01:00' },
  { id: 'st-ds-ibadan', name: 'Olumide Adeyemi', email: 'o.adeyemi@nrc.demo', role: 'district_supervisor', district: 'Ibadan', status: 'active', lastLoginAt: '2026-10-13T08:30:00+01:00' },
  { id: 'st-ds2', name: 'Hauwa Garba', email: 'h.garba@nrc.demo', role: 'district_supervisor', district: 'Lagos', status: 'suspended', lastLoginAt: '2026-08-02T10:40:00+01:00' },
  { id: 'st-hoc', name: 'Funmilayo Adebayo', email: 'f.adebayo@nrc.demo', role: 'head_of_cargo', status: 'active', lastLoginAt: '2026-10-13T07:55:00+01:00' },
  { id: 'st-dir', name: 'Aliyu Bello', email: 'a.bello@nrc.demo', role: 'director_operations', status: 'active', lastLoginAt: '2026-10-12T16:20:00+01:00' },
  { id: 'st-hop', name: 'Grace Etim', email: 'g.etim@nrc.demo', role: 'head_port_operations', status: 'active', lastLoginAt: '2026-10-13T06:45:00+01:00' },
  { id: 'st-hop2', name: 'Samuel Nwosu', email: 's.nwosu@nrc.demo', role: 'head_port_operations', status: 'pending_first_login' },
  { id: 'st-sa', name: 'Tunde Bakare', email: 't.bakare@provider.demo', role: 'super_admin', status: 'active', lastLoginAt: '2026-10-13T09:01:00+01:00' },
]

// ---------------------------------------------------------------- helpers

let docSeq = 0
const doc = (kind: DocumentKind, fileName: string, uploadedAt: string, sizeKb = 420): UploadedDocument => ({
  id: `doc-${++docSeq}`, kind, fileName, sizeKb, uploadedAt,
})

const priority = (discountPct: number, creditMonths: number, thresholdNaira: number, category: CustomerEligibility['category']): CustomerEligibility => ({
  isPriority: true, eligibleDiscountBp: discountPct * 100, eligibleCreditMonths: creditMonths, creditThreshold: naira(thresholdNaira), category,
})
const nonPriority = (category: CustomerEligibility['category']): CustomerEligibility => ({
  isPriority: false, eligibleDiscountBp: 0, eligibleCreditMonths: 0, creditThreshold: 0, category,
})

// ---------------------------------------------------------------- customers

export const customers: Customer[] = [
  {
    id: 'cus-lagoon', district: 'Lagos', companyName: 'Lagoon Freight & Logistics Ltd', cacNumber: 'RC 1458327',
    registeredAddress: '14 Wharf Road, Apapa, Lagos', modes: ['Containerized'], services: ['Clearance', 'Multi-modal'],
    poc: { name: 'Adaeze Okafor', email: 'adaeze.okafor@lagoonfreight.demo', countryCode: '+234', phone: '803 412 7781' },
    eligibility: priority(10, 2, 5_000_000, 'Strategic'), accountStatus: 'active', activatedAt: '2026-03-18T11:20:00+01:00', username: 'lagoonfreight', isDemo: true,
  },
  {
    id: 'cus-gateway', district: 'Lagos', companyName: 'Apapa Gateway Clearing Services Ltd', cacNumber: 'RC 2210984',
    registeredAddress: '7 Creek Road, Apapa, Lagos', modes: ['Containerized', 'Non-Containerized'], services: ['Clearance', 'Documentation'],
    poc: { name: 'Ibrahim Musa', email: 'i.musa@apapagateway.demo', countryCode: '+234', phone: '806 220 1194' },
    eligibility: nonPriority('SME'), accountStatus: 'active', activatedAt: '2026-05-04T09:05:00+01:00', username: 'apapagateway', isDemo: true,
  },
  {
    id: 'cus-northbound', district: 'Ibadan', companyName: 'Northbound Agro Haulage Ltd', cacNumber: 'RC 0987654',
    registeredAddress: 'Plot 22, Oyo Road, Ibadan, Oyo State', modes: ['Containerized'], services: ['Loading/Offloading', 'Multi-modal'],
    poc: { name: 'Bola Ajayi', email: 'b.ajayi@northboundagro.demo', countryCode: '+234', phone: '805 771 0032' },
    eligibility: priority(8, 1, 3_000_000, 'Bulk'), accountStatus: 'active', activatedAt: '2026-02-10T14:30:00+01:00', username: 'northboundagro', isDemo: true,
  },
  {
    id: 'cus-fgra', district: 'Lagos', companyName: 'Federal Grains Reserve Agency', cacNumber: 'RC 1102233',
    registeredAddress: 'Federal Secretariat Annex, Ikoyi, Lagos', modes: ['Containerized'], services: ['Multi-modal'],
    poc: { name: 'Nkechi Eze', email: 'n.eze@fgra.demo', countryCode: '+234', phone: '809 300 4410' },
    eligibility: priority(5, 3, 20_000_000, 'Government'), accountStatus: 'active', activatedAt: '2026-01-22T10:00:00+01:00', username: 'fgra', isDemo: true,
  },
  {
    id: 'cus-ikorodu', district: 'Lagos', companyName: 'Ikorodu Multimodal Ventures Ltd', cacNumber: 'RC 3011876',
    registeredAddress: '3 Lagos Road, Ikorodu, Lagos', modes: ['Non-Containerized'], services: ['Loading/Offloading'],
    poc: { name: 'Kunle Bakre', email: 'k.bakre@ikorodumm.demo', countryCode: '+234', phone: '802 118 5523' },
    eligibility: nonPriority('SME'), accountStatus: 'suspended', activatedAt: '2026-04-01T12:00:00+01:00', username: 'ikorodumm', isDemo: true,
  },
  {
    id: 'cus-deltaswift', district: 'Lagos', companyName: 'Delta Swift Movers Ltd', cacNumber: 'RC 2776120',
    registeredAddress: '19 Warri-Sapele Road, Warri, Delta State', modes: ['Non-Containerized'], services: ['Loading/Offloading'],
    poc: { name: 'Ese Omonigho', email: 'ops@deltaswift.demo', countryCode: '+234', phone: '807 640 9981' },
    eligibility: nonPriority('SME'), accountStatus: 'blacklisted', activatedAt: '2025-11-15T12:00:00+01:00', username: 'deltaswift', isDemo: true,
  },
]

// ---------------------------------------------------------------- audit helpers

const actors: Record<string, { name: string; role: Role | 'system' }> = {
  ds: { name: 'Chukwuemeka Obi', role: 'district_supervisor' },
  ds2: { name: 'Olumide Adeyemi', role: 'district_supervisor' },
  hoc: { name: 'Funmilayo Adebayo', role: 'head_of_cargo' },
  dir: { name: 'Aliyu Bello', role: 'director_operations' },
  hop: { name: 'Grace Etim', role: 'head_port_operations' },
  sa: { name: 'Tunde Bakare', role: 'super_admin' },
  sys: { name: 'System (simulated)', role: 'system' },
}

const d = (iso: string, hhmm: string) => `${iso.slice(0, 10)}T${hhmm}:00+01:00`

export const audit: AuditEntry[] = []
let auditSeq = 0

type Step = [at: string, actor: string, action: string, toStatus?: string, remarks?: string]

function chain(entityType: EntityType, entityId: string, entityRef: string, startStatus: string | undefined, steps: Step[]) {
  let prev = startStatus
  for (const [at, actorKey, action, toStatus, remarks] of steps) {
    const actor = actors[actorKey] ?? { name: actorKey, role: 'cargo_facilitator' as const }
    audit.push({
      id: `au-${String(++auditSeq).padStart(4, '0')}`, at, actorName: actor.name, actorRole: actor.role,
      entityType, entityId, entityRef, action, fromStatus: toStatus ? prev : undefined, toStatus, remarks,
    })
    if (toStatus) prev = toStatus
  }
}

// ---------------------------------------------------------------- registrations

const regDocs = (at: string, opts: { profile?: boolean; tax?: boolean } = {}) => [
  doc('cac_certificate', 'CAC_Certificate.pdf', at, 610),
  ...(opts.profile === false ? [] : [doc('company_profile', 'Company_Profile_2026.pdf', at, 2_140)]),
  ...(opts.tax ? [doc('tax_certificate', 'TCC_2026.pdf', at, 380)] : []),
]

function reg(
  id: string, reference: string, base: Pick<RegistrationApplication, 'companyName' | 'cacNumber' | 'registeredAddress' | 'district' | 'modes' | 'services' | 'poc'>,
  status: RegistrationStatus, submittedAt: string, updatedAt: string, documents: UploadedDocument[], extra: Partial<RegistrationApplication> = {},
): RegistrationApplication {
  return { id, reference, ...base, status, submittedAt, updatedAt, documents, isDemo: true, ...extra }
}

const fromCustomer = (c: Customer) => ({
  companyName: c.companyName, cacNumber: c.cacNumber, registeredAddress: c.registeredAddress, district: c.district, modes: c.modes, services: c.services, poc: c.poc,
})

const cust = (id: string) => customers.find((c) => c.id === id)!

export const applications: RegistrationApplication[] = [
  reg('reg-fgra', 'REG-2026-0012', fromCustomer(cust('cus-fgra')), 'activated', '2026-01-15T09:00:00+01:00', '2026-01-22T10:00:00+01:00', regDocs('2026-01-15T09:00:00+01:00', { tax: true }), { customerId: 'cus-fgra' }),
  reg('reg-northbound', 'REG-2026-0019', fromCustomer(cust('cus-northbound')), 'activated', '2026-02-03T10:10:00+01:00', '2026-02-10T14:30:00+01:00', regDocs('2026-02-03T10:10:00+01:00'), { customerId: 'cus-northbound' }),
  reg('reg-lagoon', 'REG-2026-0034', fromCustomer(cust('cus-lagoon')), 'activated', '2026-03-09T13:45:00+01:00', '2026-03-18T11:20:00+01:00', regDocs('2026-03-09T13:45:00+01:00', { tax: true }), { customerId: 'cus-lagoon' }),
  reg('reg-gateway', 'REG-2026-0051', fromCustomer(cust('cus-gateway')), 'activated', '2026-04-27T08:30:00+01:00', '2026-05-04T09:05:00+01:00', regDocs('2026-04-27T08:30:00+01:00'), { customerId: 'cus-gateway' }),
  reg('reg-ogun', 'REG-2026-0101', {
    district: 'Ibadan',
    companyName: 'Ogun Valley Logistics Ltd', cacNumber: 'RC 3348810', registeredAddress: '41 Abeokuta Expressway, Sango-Ota, Ogun State',
    modes: ['Containerized'], services: ['Clearance', 'Loading/Offloading'],
    poc: { name: 'Temitope Salami', email: 't.salami@ogunvalley.demo', countryCode: '+234', phone: '813 552 0917' },
  }, 'pending_district_verification', '2026-10-12T15:22:00+01:00', '2026-10-12T15:22:00+01:00', regDocs('2026-10-12T15:22:00+01:00', { tax: true })),
  reg('reg-ekobulk', 'REG-2026-0102', {
    district: 'Lagos',
    companyName: 'Eko Bulk Terminals Ltd', cacNumber: 'RC 3360042', registeredAddress: '9 Point Road, Tin Can Island, Lagos',
    modes: ['Non-Containerized'], services: ['Loading/Offloading'],
    poc: { name: 'Yusuf Danjuma', email: 'y.danjuma@ekobulk.demo', countryCode: '+234', phone: '816 004 3381' },
  }, 'pending_district_verification', '2026-10-13T08:40:00+01:00', '2026-10-13T08:40:00+01:00', regDocs('2026-10-13T08:40:00+01:00', { profile: false })),
  reg('reg-swiftdelta', 'REG-2026-0107', {
    district: 'Lagos',
    companyName: 'Swift Delta Movers Nig. Ltd', cacNumber: 'RC 2776120', registeredAddress: '2 Airport Road, Effurun, Delta State',
    modes: ['Non-Containerized'], services: ['Loading/Offloading'],
    poc: { name: 'Ese Omonigho', email: 'ese@swiftdelta.demo', countryCode: '+234', phone: '807 640 9981' },
  }, 'pending_district_verification', '2026-10-13T09:15:00+01:00', '2026-10-13T09:15:00+01:00', regDocs('2026-10-13T09:15:00+01:00')),
  reg('reg-transsahel', 'REG-2026-0103', {
    district: 'Lagos',
    companyName: 'Trans-Sahel Freight Nigeria Ltd', cacNumber: 'RC 1890275', registeredAddress: '55 Herbert Macaulay Way, Yaba, Lagos',
    modes: ['Containerized', 'Non-Containerized'], services: ['Clearance', 'Documentation', 'Multi-modal'],
    poc: { name: 'Halima Sani', email: 'h.sani@transsahel.demo', countryCode: '+234', phone: '803 990 2210' },
  }, 'pending_director_approval', '2026-10-08T11:00:00+01:00', '2026-10-10T14:05:00+01:00', regDocs('2026-10-08T11:00:00+01:00', { tax: true })),
  reg('reg-marina', 'REG-2026-0104', {
    district: 'Lagos',
    companyName: 'Marina Clearing Agency', cacNumber: 'BN 4419027', registeredAddress: '120 Broad Street, Lagos Island, Lagos',
    modes: ['Containerized'], services: ['Clearance', 'Documentation'],
    poc: { name: 'Obinna Chukwu', email: 'obinna@marinaclearing.demo', countryCode: '+234', phone: '802 771 6604' },
  }, 'sent_back_to_facilitator', '2026-10-06T10:30:00+01:00', '2026-10-07T12:10:00+01:00', regDocs('2026-10-06T10:30:00+01:00'), {
    latestRemark: 'CAC certificate scan is illegible and the registration number cannot be confirmed. Please re-upload a clear copy.',
  }),
  reg('reg-coastline', 'REG-2026-0105', {
    district: 'Lagos',
    companyName: 'Coastline Cargo Partners Ltd', cacNumber: 'RC 2210984', registeredAddress: '7B Creek Road, Apapa, Lagos',
    modes: ['Containerized'], services: ['Clearance'],
    poc: { name: 'Peter Okon', email: 'p.okon@coastlinecargo.demo', countryCode: '+234', phone: '805 118 4402' },
  }, 'rejected', '2026-09-29T09:00:00+01:00', '2026-10-02T16:45:00+01:00', regDocs('2026-09-29T09:00:00+01:00'), {
    latestRemark: 'CAC number RC 2210984 is already registered to an active customer. Application rejected.',
  }),
  reg('reg-beninore', 'REG-2026-0106', {
    district: 'Ibadan',
    companyName: 'Benin-Ore Haulage Ltd', cacNumber: 'RC 2054117', registeredAddress: '88 Sapele Road, Benin City, Edo State',
    modes: ['Non-Containerized'], services: ['Loading/Offloading', 'Multi-modal'],
    poc: { name: 'Osaro Igbinedion', email: 'osaro@beninore.demo', countryCode: '+234', phone: '808 225 7713' },
  }, 'sent_back_to_district', '2026-10-01T10:00:00+01:00', '2026-10-09T10:30:00+01:00', regDocs('2026-10-01T10:00:00+01:00', { tax: true }), {
    latestRemark: 'Registered address on the form differs from the CAC certificate. Please confirm with the applicant before forwarding.',
  }),
]

for (const a of applications) {
  const fac = a.poc.name
  const steps: Step[] = [[a.submittedAt, fac, 'Registration submitted', 'pending_district_verification']]
  switch (a.status) {
    case 'activated':
      steps.push(
        [d(a.submittedAt, '15:00'), 'ds', 'Documents verified; forwarded to Director', 'pending_director_approval', 'All documents match submitted details.'],
        [a.updatedAt, 'dir', 'Registration approved; eligibility assigned; credentials generated (simulated)', 'activated'],
      )
      break
    case 'pending_director_approval':
      steps.push([a.updatedAt, 'ds', 'Documents verified; forwarded to Director', 'pending_director_approval', 'CAC, profile and TCC verified.'])
      break
    case 'sent_back_to_facilitator':
      steps.push([a.updatedAt, 'ds', 'Sent back to facilitator (email simulated)', 'sent_back_to_facilitator', a.latestRemark])
      break
    case 'rejected':
      // District Supervisor cannot reject (baseline §3.2) — forwards the flagged application; Director rejects.
      steps.push(
        [d(a.submittedAt, '16:30'), 'ds', 'Forwarded to Director with duplicate-CAC flag', 'pending_director_approval', 'Automated check: CAC matches an active customer.'],
        [a.updatedAt, 'dir', 'Registration rejected', 'rejected', a.latestRemark],
      )
      break
    case 'sent_back_to_district':
      steps.push(
        ['2026-10-03T09:30:00+01:00', 'ds', 'Documents verified; forwarded to Director', 'pending_director_approval'],
        [a.updatedAt, 'dir', 'Sent back to District Supervisor', 'sent_back_to_district', a.latestRemark],
      )
      break
  }
  // District Supervisor entries are attributed to the supervisor of the application's district.
  chain('registration', a.id, a.reference, undefined, steps.map((st) => (st[1] === 'ds' && a.district === 'Ibadan' ? [st[0], 'ds2', ...st.slice(2)] as Step : st)))
}

// ---------------------------------------------------------------- bookings

interface BookingSeed {
  id: string
  ref: string
  customerId: string
  routeId: string
  cargoType: CargoType
  containers: ContainerLine[]
  bookingDate: string
  weightTons: number
  commodity: string
  hazardous?: boolean
  specialHandling?: string
  status: BookingStatus
  createdAt: string
  approval?: { discountPct: number; terms: PaymentTerms; creditMonths: number; at: string }
  payment: Booking['payment']
  dispatch?: Booking['dispatch']
  awbSeq?: number
  awbAt?: string
}

function bookingDocs(at: string, hazardous: boolean): UploadedDocument[] {
  return [
    doc('bill_of_lading', 'Bill_of_Lading.pdf', at, 540),
    doc('packing_list', 'Packing_List.pdf', at, 210),
    doc('invoice', 'Commercial_Invoice.pdf', at, 190),
    doc('customs_clearance', 'Customs_Release_Order.pdf', at, 330),
    ...(hazardous ? [doc('hazardous_compliance', 'IMDG_Dangerous_Goods_Declaration.pdf', at, 470)] : []),
  ]
}

function buildBooking(s: BookingSeed): Booking {
  const customer = cust(s.customerId)
  const priceInput = { routeId: s.routeId, cargoType: s.cargoType, containers: s.containers, bookingDate: s.bookingDate }
  const indicativePrice = calculatePrice({ ...priceInput, discountBp: indicativeDiscountBp(customer.eligibility) }, freightRates, config.tax)
  const approved = s.approval && {
    price: calculatePrice({ ...priceInput, discountBp: s.approval.discountPct * 100 }, freightRates, config.tax),
    paymentTerms: s.approval.terms,
    creditMonths: s.approval.creditMonths,
    approvedAt: s.approval.at,
    eligibilitySnapshot: { ...customer.eligibility },
  }
  const awb = s.awbSeq && s.awbAt
    ? { number: formatAwbNumber(2026, s.awbSeq), version: 1, generatedAt: s.awbAt, verificationRef: demoVerificationRef(formatAwbNumber(2026, s.awbSeq)) }
    : undefined
  return {
    id: s.id, reference: s.ref, customerId: s.customerId, bookingDate: s.bookingDate, cargoType: s.cargoType, routeId: s.routeId,
    containers: s.containers, weightTons: s.weightTons, commodity: s.commodity, hazardous: !!s.hazardous, specialHandling: s.specialHandling,
    documents: bookingDocs(s.createdAt, !!s.hazardous), status: s.status, indicativePrice, approved, payment: s.payment,
    dispatch: s.dispatch, awb, createdAt: s.createdAt, updatedAt: s.awbAt ?? s.approval?.at ?? s.createdAt, isDemo: true,
  }
}

const seeds: BookingSeed[] = [
  { id: 'bk-0418', ref: 'NRC-BK-2026-0418', customerId: 'cus-lagoon', routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 2 }],
    bookingDate: '2026-10-20', weightTons: 38, commodity: 'Packaged beverages', status: 'pending_hoc_review', createdAt: '2026-10-13T09:40:00+01:00', payment: { status: 'not_due' } },
  { id: 'bk-0419', ref: 'NRC-BK-2026-0419', customerId: 'cus-gateway', routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 2 }],
    bookingDate: '2026-10-21', weightTons: 41, commodity: 'Building materials (tiles)', status: 'pending_hoc_review', createdAt: '2026-10-13T10:05:00+01:00', payment: { status: 'not_due' } },
  { id: 'bk-0412', ref: 'NRC-BK-2026-0412', customerId: 'cus-northbound', routeId: 'rt-mny', cargoType: 'Containerized', containers: [{ containerType: '40ft', quantity: 3 }, { containerType: 'Reefer', quantity: 1 }],
    bookingDate: '2026-10-18', weightTons: 96, commodity: 'Agro-chemicals (fertiliser additives)', hazardous: true, specialHandling: 'Class 8 corrosive — segregate from foodstuffs',
    status: 'pending_director_review', createdAt: '2026-10-10T13:15:00+01:00', payment: { status: 'not_due' } },
  { id: 'bk-0420', ref: 'NRC-BK-2026-0420', customerId: 'cus-northbound', routeId: 'rt-apl', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 3 }],
    bookingDate: '2026-10-16', weightTons: 52, commodity: 'Bagged maize', status: 'awaiting_payment', createdAt: '2026-10-09T09:00:00+01:00',
    approval: { discountPct: 8, terms: 'pay_now', creditMonths: 0, at: '2026-10-11T15:30:00+01:00' },
    payment: { status: 'failed', dueBy: '2026-10-14T15:30:00+01:00', reference: 'DEMO-PSK-77120' } },
  { id: 'bk-0405', ref: 'NRC-BK-2026-0405', customerId: 'cus-lagoon', routeId: 'rt-apl', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 4 }, { containerType: '40ft', quantity: 2 }],
    bookingDate: '2026-10-15', weightTons: 104, commodity: 'Consumer electronics', status: 'credit_approved', createdAt: '2026-10-06T10:20:00+01:00',
    approval: { discountPct: 8, terms: 'pay_after_credit', creditMonths: 2, at: '2026-10-08T12:00:00+01:00' }, payment: { status: 'credit_outstanding', dueBy: '2026-12-08T12:00:00+01:00' } },
  { id: 'bk-0401', ref: 'NRC-BK-2026-0401', customerId: 'cus-gateway', routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '40ft', quantity: 1 }],
    bookingDate: '2026-10-17', weightTons: 24, commodity: 'Textiles', status: 'awaiting_payment', createdAt: '2026-10-07T11:00:00+01:00',
    approval: { discountPct: 0, terms: 'pay_now', creditMonths: 0, at: '2026-10-12T10:15:00+01:00' }, payment: { status: 'pending', dueBy: '2026-10-15T10:15:00+01:00', reference: 'DEMO-PSK-77158' } },
  { id: 'bk-0398', ref: 'NRC-BK-2026-0398', customerId: 'cus-gateway', routeId: 'rt-apl', cargoType: 'Non-Containerized', containers: [{ containerType: 'Wagon', quantity: 3 }],
    bookingDate: '2026-10-14', weightTons: 90, commodity: 'Steel billets', status: 'pending_dispatch', createdAt: '2026-10-03T09:30:00+01:00',
    approval: { discountPct: 0, terms: 'pay_now', creditMonths: 0, at: '2026-10-06T14:00:00+01:00' }, payment: { status: 'paid', paidAt: '2026-10-07T09:12:00+01:00', reference: 'DEMO-PSK-76904' } },
  { id: 'bk-0390', ref: 'NRC-BK-2026-0390', customerId: 'cus-fgra', routeId: 'rt-mny', cargoType: 'Containerized', containers: [{ containerType: '40ft', quantity: 6 }],
    bookingDate: '2026-10-12', weightTons: 160, commodity: 'Strategic grain reserve (sorghum)', status: 'awb_generated', createdAt: '2026-09-29T10:00:00+01:00',
    approval: { discountPct: 5, terms: 'pay_after_credit', creditMonths: 3, at: '2026-10-02T11:45:00+01:00' }, payment: { status: 'credit_outstanding', dueBy: '2027-01-02T11:45:00+01:00' },
    dispatch: { wagonNumber: 'NRC-FW-21407', trainNumber: 'LI-FR-07', departureDate: '2026-10-12', departureTime: '06:30', loadingYard: 'Apapa Yard B', remarks: 'Six flat wagons, tarpaulin checked.' },
    awbSeq: 101, awbAt: '2026-10-11T17:20:00+01:00' },
  { id: 'bk-0377', ref: 'NRC-BK-2026-0377', customerId: 'cus-lagoon', routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '40ft', quantity: 2 }],
    bookingDate: '2026-09-30', weightTons: 47, commodity: 'Household appliances', status: 'completed', createdAt: '2026-09-22T08:50:00+01:00',
    approval: { discountPct: 10, terms: 'pay_now', creditMonths: 0, at: '2026-09-24T13:00:00+01:00' }, payment: { status: 'paid', paidAt: '2026-09-24T16:40:00+01:00', reference: 'DEMO-PSK-75511' },
    dispatch: { wagonNumber: 'NRC-CW-11820', trainNumber: 'LI-FR-03', departureDate: '2026-09-30', departureTime: '05:45', loadingYard: 'Apapa Yard A' },
    awbSeq: 98, awbAt: '2026-09-29T18:05:00+01:00' },
  { id: 'bk-0395', ref: 'NRC-BK-2026-0395', customerId: 'cus-northbound', routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 5 }],
    bookingDate: '2026-10-19', weightTons: 88, commodity: 'Bagged cement', status: 'sent_back_to_facilitator', createdAt: '2026-10-08T14:10:00+01:00', payment: { status: 'not_due' } },
  { id: 'bk-0386', ref: 'NRC-BK-2026-0386', customerId: 'cus-gateway', routeId: 'rt-apl', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 1 }],
    bookingDate: '2026-10-09', weightTons: 18, commodity: 'Used auto parts', status: 'rejected_hoc', createdAt: '2026-10-01T09:00:00+01:00', payment: { status: 'not_due' } },
  { id: 'bk-0383', ref: 'NRC-BK-2026-0383', customerId: 'cus-gateway', routeId: 'rt-ebm', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 2 }],
    bookingDate: '2026-10-05', weightTons: 36, commodity: 'Rice (bagged)', status: 'auto_cancelled', createdAt: '2026-09-28T10:00:00+01:00',
    approval: { discountPct: 0, terms: 'pay_now', creditMonths: 0, at: '2026-09-30T09:00:00+01:00' }, payment: { status: 'cancelled', dueBy: '2026-10-03T09:00:00+01:00', reference: 'DEMO-PSK-75990' } },
  { id: 'bk-0380', ref: 'NRC-BK-2026-0380', customerId: 'cus-lagoon', routeId: 'rt-mny', cargoType: 'Containerized', containers: [{ containerType: '20ft', quantity: 2 }],
    bookingDate: '2026-10-08', weightTons: 31, commodity: 'Ceramic sanitaryware', status: 'rejected_physical', createdAt: '2026-09-26T12:00:00+01:00',
    approval: { discountPct: 10, terms: 'pay_now', creditMonths: 0, at: '2026-09-29T10:30:00+01:00' }, payment: { status: 'paid', paidAt: '2026-09-29T14:02:00+01:00', reference: 'DEMO-PSK-75870' } },
]

export const bookings: Booking[] = seeds.map(buildBooking)

const fac = (b: Booking) => cust(b.customerId).poc.name

for (const b of bookings) {
  const s = seeds.find((x) => x.id === b.id)!
  const steps: Step[] = [
    [b.createdAt, fac(b), 'Booking submitted with compliance declaration', 'pending_hoc_review', 'Facilitator accepted indicative amount and terms. No payment taken.'],
  ]
  const hocOk: Step = [d(b.createdAt, '16:00'), 'hoc', 'Documents and cargo verified; forwarded to Director', 'pending_director_review']
  const dirOk = (): Step => {
    const a = s.approval!
    const reduced = cust(b.customerId).eligibility.isPriority && a.discountPct * 100 < cust(b.customerId).eligibility.eligibleDiscountBp
    const to = a.terms === 'pay_now' ? 'awaiting_payment' : 'credit_approved'
    return [a.at, 'dir', `Approved — ${a.terms === 'pay_now' ? 'Payment Link Now' : `Pay after ${a.creditMonths}-month credit`}; price frozen`, to,
      reduced ? `Discount granted ${a.discountPct}% (below eligible maximum). Reason: volume below committed tonnage this quarter.` : undefined]
  }
  switch (b.status) {
    case 'pending_director_review':
      steps.push(hocOk)
      break
    case 'sent_back_to_facilitator':
      steps.push([d(b.createdAt, '17:20'), 'hoc', 'Sent back to facilitator (email simulated)', 'sent_back_to_facilitator', 'Packing list total (88t) does not match the Bill of Lading (92t). Please correct and resubmit.'])
      break
    case 'rejected_hoc':
      steps.push([d(b.createdAt, '15:10'), 'hoc', 'Rejected', 'rejected_hoc', 'Bill of Lading is for a different consignee. No payment taken; no refund required.'])
      break
    case 'awaiting_payment':
      steps.push(hocOk, dirOk(), [s.approval!.at, 'sys', 'Invoice generated; payment link issued (simulated, no gateway contacted)'])
      if (b.payment.status === 'failed') steps.push(['2026-10-12T11:05:00+01:00', 'sys', 'Payment attempt failed (simulated)', undefined, 'Card declined by issuer (demo outcome).'])
      break
    case 'credit_approved':
      steps.push(hocOk, dirOk(), [s.approval!.at, 'sys', 'Credit period started; invoice generated (simulated)'])
      break
    case 'pending_dispatch':
      steps.push(hocOk, dirOk(), [b.payment.paidAt!, 'sys', 'Payment confirmed (simulated reconciliation)', 'pending_dispatch', `Ref ${b.payment.reference}`])
      break
    case 'auto_cancelled':
      steps.push(hocOk, dirOk(),
        ['2026-10-01T09:00:00+01:00', 'sys', 'Payment reminder sent (24h, simulated)'],
        [b.payment.dueBy!, 'sys', 'Auto-cancelled — payment window (72h, proposed) elapsed; capacity released', 'auto_cancelled'])
      break
    case 'rejected_physical':
      steps.push(hocOk, dirOk(),
        [b.payment.paidAt!, 'sys', 'Payment confirmed (simulated reconciliation)', 'pending_dispatch', `Ref ${b.payment.reference}`],
        ['2026-10-07T10:40:00+01:00', 'hop', 'Physical verification failed; reported to Director', 'rejected_physical', 'Declared weight 31t; weighbridge reading 38.6t. One container seal broken. Capacity released.'])
      break
    case 'awb_generated':
    case 'completed':
      steps.push(hocOk, dirOk())
      if (b.payment.status === 'paid') steps.push([b.payment.paidAt!, 'sys', 'Payment confirmed (simulated reconciliation)', 'pending_dispatch', `Ref ${b.payment.reference}`])
      steps.push([b.awb!.generatedAt, 'hop', `Physical verification passed; dispatch approved; AWB ${b.awb!.number} generated`, 'awb_generated',
        `Train ${b.dispatch!.trainNumber}, wagon ${b.dispatch!.wagonNumber}, departs ${b.dispatch!.departureDate} ${b.dispatch!.departureTime}`])
      if (b.status === 'completed') steps.push([d(b.dispatch!.departureDate, '14:30'), 'hop', 'Consignment delivered; booking completed', 'completed'])
      break
  }
  chain('booking', b.id, b.reference, undefined, steps)
}

chain('customer', 'cus-northbound', 'Northbound Agro Haulage Ltd', undefined, [['2026-07-01T10:00:00+01:00', 'dir', 'Eligibility upgraded: Non-Priority → Priority (8%)', undefined, 'Consistent volumes over two quarters. Existing bookings unaffected.']])
audit[audit.length - 1]!.change = { field: 'Eligible discount', from: '0% (Non-Priority)', to: '8% (Priority)' }
chain('customer', 'cus-ikorodu', 'Ikorodu Multimodal Ventures Ltd', 'active', [['2026-09-14T12:00:00+01:00', 'dir', 'Customer account suspended', 'suspended', 'Repeated unpaid booking cancellations.']])
chain('master_data', 'fr-ebm-20', 'APP-EBM 20ft rate', undefined, [['2025-12-15T09:00:00+01:00', 'sa', 'Freight rate row inserted (effective 2026-01-01)', undefined, 'Superseding row fr-ebm-20-old; prior row retained.']])
audit[audit.length - 1]!.change = { field: 'APP-EBM / Containerized / 20ft', from: '₦85,000.00', to: '₦90,000.00' }
chain('staff', 'st-hop2', 'Samuel Nwosu', undefined, [['2026-10-10T09:30:00+01:00', 'sa', 'Staff account created — Head of Port Operations (credentials issued, simulated)', 'pending_first_login']])
chain('staff', 'st-ds2', 'Hauwa Garba', 'active', [['2026-08-20T11:00:00+01:00', 'sa', 'Staff access suspended', 'suspended', 'Staff transfer — access revoked on NRC HR instruction.']])

audit.sort((a, b) => a.at.localeCompare(b.at))

export const refunds: Refund[] = [
  { id: 'rf-0380', bookingId: 'bk-0380', amount: bookings.find((b) => b.id === 'bk-0380')!.approved!.price.totalPayable,
    reason: 'Physical verification failed at Apapa (weight mismatch, broken seal).', status: 'awaiting_director', createdAt: '2026-10-07T10:40:00+01:00' },
]

export const paymentExceptions: PaymentException[] = [
  { id: 'px-1', reference: 'DEMO-PSK-76011', amount: naira(214_000), receivedAt: '2026-10-09T13:22:00+01:00', issue: 'Amount received does not match any open invoice.', resolved: false },
  { id: 'px-2', reference: 'DEMO-PSK-75870-DUP', amount: bookings.find((b) => b.id === 'bk-0380')!.approved!.price.totalPayable, receivedAt: '2026-09-29T14:05:00+01:00', issue: 'Possible duplicate payment for NRC-BK-2026-0380.', resolved: false },
]

export const counters = { nextBookingSeq: 421, nextRegistrationSeq: 108, nextAwbSeq: 102 }
