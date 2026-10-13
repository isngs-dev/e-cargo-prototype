// Domain model for the NRC e-Cargo prototype.
// All money values are integers in kobo (₦1 = 100 kobo). Percentages are basis points (1% = 100 bp).

export type Kobo = number
export type BasisPoints = number
export type ISODate = string // YYYY-MM-DD
export type ISODateTime = string

export type Role =
  | 'cargo_facilitator'
  | 'district_supervisor'
  | 'head_of_cargo'
  | 'director_operations'
  | 'head_port_operations'
  | 'super_admin'

export interface Persona {
  id: string
  name: string
  role: Role
  title: string
  /** Facilitator personas act on behalf of one customer company. */
  customerId?: string
}

// ---------------------------------------------------------------- Customers

export type CustomerCategory = 'Bulk' | 'SME' | 'Strategic' | 'Government'
export type ModeOfOperation = 'Containerized' | 'Non-Containerized'
export type ServiceProvided = 'Clearance' | 'Loading/Offloading' | 'Documentation' | 'Multi-modal'
export type CustomerAccountStatus = 'active' | 'suspended' | 'blacklisted'

/** Eligibility is set by the Director at registration (and may be changed between bookings). */
export interface CustomerEligibility {
  isPriority: boolean
  /** Maximum discount grantable on any future booking. Always 0 for non-priority. */
  eligibleDiscountBp: BasisPoints
  /** Maximum credit period grantable on any future booking. Always 0 for non-priority. */
  eligibleCreditMonths: number
  /** Maximum outstanding (unpaid credit) balance permitted. */
  creditThreshold: Kobo
  category: CustomerCategory
}

export interface Customer {
  id: string
  companyName: string
  cacNumber: string
  registeredAddress: string
  modes: ModeOfOperation[]
  services: ServiceProvided[]
  poc: { name: string; email: string; countryCode: string; phone: string }
  eligibility: CustomerEligibility
  accountStatus: CustomerAccountStatus
  activatedAt: ISODateTime
  username: string
  isDemo: true
}

// ---------------------------------------------------------- Registration

export type RegistrationStatus =
  | 'pending_district_verification'
  | 'sent_back_to_facilitator'
  | 'pending_director_approval'
  | 'sent_back_to_district'
  | 'activated'
  | 'rejected'

export type DocumentKind =
  | 'cac_certificate'
  | 'company_profile'
  | 'tax_certificate'
  | 'bill_of_lading'
  | 'packing_list'
  | 'invoice'
  | 'radiation_certificate'
  | 'customs_clearance'
  | 'hazardous_compliance'

/** Simulated upload — file content is never transmitted anywhere. */
export interface UploadedDocument {
  id: string
  kind: DocumentKind
  fileName: string
  sizeKb: number
  uploadedAt: ISODateTime
}

export interface RegistrationApplication {
  id: string
  reference: string
  companyName: string
  cacNumber: string
  registeredAddress: string
  modes: ModeOfOperation[]
  services: ServiceProvided[]
  poc: { name: string; email: string; countryCode: string; phone: string }
  documents: UploadedDocument[]
  status: RegistrationStatus
  submittedAt: ISODateTime
  updatedAt: ISODateTime
  /** Set once activated. */
  customerId?: string
  latestRemark?: string
  isDemo: true
}

// ---------------------------------------------------------- Master data

export type CargoType = 'Containerized' | 'Non-Containerized'
export type ContainerType = '20ft' | '40ft' | 'Reefer' | 'Wagon'

export interface Route {
  id: string
  code: string
  origin: string
  destination: string
  distanceKm: number
  active: boolean
}

/** Effective-dated: a rate change inserts a new row, never edits an existing one. */
export interface FreightRate {
  id: string
  routeId: string
  cargoType: CargoType
  /** 'Wagon' is the unit for non-containerized cargo (demo assumption, see DECISIONS.md). */
  containerType: ContainerType
  ratePerUnit: Kobo
  effectiveFrom: ISODate
}

export interface TaxConfig {
  vatBp: BasisPoints
  stampDutyBp: BasisPoints
  insuranceBp: BasisPoints
  /** UNRESOLVED (NRC open item #1). Prototype default: 'net'. */
  basis: 'net' | 'gross'
}

export interface PlatformConfig {
  tax: TaxConfig
  /** UNRESOLVED (open item #4). Proposed 72h. */
  paymentWindowHours: number
  paymentReminderHours: number
  /** UNRESOLVED (open item #3). Proposed 30 days. */
  refundWindowDays: number
  taxCertificateRequired: boolean
}

// ---------------------------------------------------------- Bookings

export type BookingStatus =
  | 'draft'
  | 'pending_hoc_review'
  | 'sent_back_to_facilitator'
  | 'pending_director_review'
  | 'sent_back_to_hoc'
  | 'awaiting_payment'
  | 'credit_approved'
  | 'pending_dispatch'
  | 'awb_generated'
  | 'completed'
  | 'rejected_hoc'
  | 'rejected_director'
  | 'rejected_physical'
  | 'auto_cancelled'

export type PaymentTerms = 'pay_now' | 'pay_after_credit'

export type PaymentStatus =
  | 'not_due' // before Director approval
  | 'pending' // link issued, awaiting payment
  | 'paid'
  | 'failed'
  | 'credit_outstanding'
  | 'credit_settled'
  | 'cancelled'

export interface ContainerLine {
  containerType: ContainerType
  quantity: number
}

export interface PriceLine {
  containerType: ContainerType
  quantity: number
  ratePerUnit: Kobo
  rateId: string
  amount: Kobo
}

export interface PriceBreakdown {
  lines: PriceLine[]
  baseFreight: Kobo
  discountBp: BasisPoints
  discount: Kobo
  netFreight: Kobo
  taxBasis: 'net' | 'gross'
  vat: Kobo
  stampDuty: Kobo
  insurance: Kobo
  totalPayable: Kobo
  rates: { vatBp: BasisPoints; stampDutyBp: BasisPoints; insuranceBp: BasisPoints }
}

export interface DispatchDetails {
  wagonNumber: string
  trainNumber: string
  departureDate: ISODate
  departureTime: string
  loadingYard?: string
  remarks?: string
}

export interface Awb {
  number: string
  version: number
  generatedAt: ISODateTime
  /** Demo-only verification target. Not a signed URL. */
  verificationRef: string
}

export interface Booking {
  id: string
  reference: string
  customerId: string
  bookingDate: ISODate
  cargoType: CargoType
  routeId: string
  containers: ContainerLine[]
  weightTons: number
  commodity: string
  hazardous: boolean
  specialHandling?: string
  remarks?: string
  documents: UploadedDocument[]
  status: BookingStatus
  /** Indicative price shown to the facilitator at submission (uses eligible discount). */
  indicativePrice: PriceBreakdown
  /** Frozen at Director approval. Never recalculated afterwards. */
  approved?: {
    price: PriceBreakdown
    paymentTerms: PaymentTerms
    creditMonths: number
    approvedAt: ISODateTime
    /** Snapshot of the eligibility in force at approval. */
    eligibilitySnapshot: CustomerEligibility
  }
  payment: { status: PaymentStatus; dueBy?: ISODateTime; paidAt?: ISODateTime; reference?: string }
  dispatch?: DispatchDetails
  awb?: Awb
  createdAt: ISODateTime
  updatedAt: ISODateTime
  isDemo: true
}

// ---------------------------------------------------------- Staff, audit, refunds

export type StaffStatus = 'active' | 'suspended' | 'pending_first_login'

export interface StaffAccount {
  id: string
  name: string
  email: string
  role: Exclude<Role, 'cargo_facilitator'>
  status: StaffStatus
  lastLoginAt?: ISODateTime
}

export type EntityType = 'registration' | 'booking' | 'customer' | 'staff' | 'master_data' | 'refund' | 'payment' | 'system'

export interface AuditEntry {
  id: string
  at: ISODateTime
  actorName: string
  actorRole: Role | 'system'
  entityType: EntityType
  entityId: string
  entityRef: string
  action: string
  fromStatus?: string
  toStatus?: string
  remarks?: string
  /** Old → new value for configuration / eligibility changes. */
  change?: { field: string; from: string; to: string }
}

export type RefundStatus = 'awaiting_director' | 'link_sent' | 'requested' | 'under_review' | 'approved' | 'processed'

export interface Refund {
  id: string
  bookingId: string
  amount: Kobo
  reason: string
  status: RefundStatus
  createdAt: ISODateTime
}

export interface PaymentException {
  id: string
  reference: string
  amount: Kobo
  receivedAt: ISODateTime
  issue: string
  resolved: boolean
}
