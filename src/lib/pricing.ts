import type {
  BasisPoints,
  CargoType,
  ContainerLine,
  FreightRate,
  ISODate,
  PriceBreakdown,
  PriceLine,
  TaxConfig,
} from '@/types/domain'
import { applyBp } from './money'

/**
 * Pricing — calculation order (confirmed baseline doc §7.1):
 *   Base Freight = Σ rate(route, cargo type, container type) × quantity
 *   Discount     = Base Freight × discount %        [priority customers only]
 *   Net Freight  = Base Freight − Discount
 *   VAT / Stamp Duty / Insurance on Net Freight      [basis UNRESOLVED — configurable]
 *   Total        = Net Freight + VAT + Stamp Duty + Insurance
 */

export class PricingError extends Error {
  constructor(
    message: string,
    readonly code: 'NO_RATE' | 'NO_CONTAINERS' | 'INVALID_QUANTITY' | 'INVALID_DISCOUNT',
  ) {
    super(message)
    this.name = 'PricingError'
  }
}

/** Latest rate row whose effective date is on or before the booking date. */
export function findRate(
  rates: FreightRate[],
  routeId: string,
  cargoType: CargoType,
  containerType: ContainerLine['containerType'],
  onDate: ISODate,
): FreightRate | undefined {
  return rates
    .filter(
      (r) =>
        r.routeId === routeId &&
        r.cargoType === cargoType &&
        r.containerType === containerType &&
        r.effectiveFrom <= onDate,
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
}

export interface PriceInput {
  routeId: string
  cargoType: CargoType
  containers: ContainerLine[]
  bookingDate: ISODate
  discountBp: BasisPoints
}

/** Throws PricingError rather than ever returning a zero/partial price. */
export function calculatePrice(input: PriceInput, rates: FreightRate[], tax: TaxConfig): PriceBreakdown {
  if (input.containers.length === 0) {
    throw new PricingError('At least one container or wagon line is required.', 'NO_CONTAINERS')
  }
  if (input.discountBp < 0 || input.discountBp > 10_000) {
    throw new PricingError('Discount must be between 0% and 100%.', 'INVALID_DISCOUNT')
  }

  const lines: PriceLine[] = input.containers.map((c) => {
    if (!Number.isInteger(c.quantity) || c.quantity <= 0) {
      throw new PricingError(`Quantity for ${c.containerType} must be a whole number above zero.`, 'INVALID_QUANTITY')
    }
    const rate = findRate(rates, input.routeId, input.cargoType, c.containerType, input.bookingDate)
    if (!rate || rate.ratePerUnit <= 0) {
      throw new PricingError(
        `No freight rate is configured for ${input.cargoType} / ${c.containerType} on this route for ${input.bookingDate}. Booking cannot be priced.`,
        'NO_RATE',
      )
    }
    return {
      containerType: c.containerType,
      quantity: c.quantity,
      ratePerUnit: rate.ratePerUnit,
      rateId: rate.id,
      amount: rate.ratePerUnit * c.quantity,
    }
  })

  const baseFreight = lines.reduce((sum, l) => sum + l.amount, 0)
  const discount = applyBp(baseFreight, input.discountBp)
  const netFreight = baseFreight - discount
  const taxable = tax.basis === 'net' ? netFreight : baseFreight
  const vat = applyBp(taxable, tax.vatBp)
  const stampDuty = applyBp(taxable, tax.stampDutyBp)
  const insurance = applyBp(taxable, tax.insuranceBp)

  return {
    lines,
    baseFreight,
    discountBp: input.discountBp,
    discount,
    netFreight,
    taxBasis: tax.basis,
    vat,
    stampDuty,
    insurance,
    totalPayable: netFreight + vat + stampDuty + insurance,
    rates: { vatBp: tax.vatBp, stampDutyBp: tax.stampDutyBp, insuranceBp: tax.insuranceBp },
  }
}

/** Safe wrapper for UI: returns either a price or a user-facing error. */
export function tryCalculatePrice(
  input: PriceInput,
  rates: FreightRate[],
  tax: TaxConfig,
): { ok: true; price: PriceBreakdown } | { ok: false; error: string } {
  try {
    return { ok: true, price: calculatePrice(input, rates, tax) }
  } catch (e) {
    if (e instanceof PricingError) return { ok: false, error: e.message }
    throw e
  }
}
