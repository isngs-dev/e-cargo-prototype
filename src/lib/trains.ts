import type { ISODate } from '@/types/domain'

/** Demonstration train timetable (illustrative — not NRC's schedule). Entering a train number fills in the rest. */
export interface Train {
  trainNumber: string
  /** Departure time HH:MM. */
  departureTime: string
  loadingYard: string
  /** Operating weekdays, 0 = Sunday … 6 = Saturday. */
  days: number[]
  note: string
}

export const trains: Train[] = [
  { trainNumber: 'LI-FR-03', departureTime: '05:45', loadingYard: 'Apapa Yard A', days: [1, 2, 3, 4, 5], note: 'Apapa → Ebute Metta, weekdays' },
  { trainNumber: 'LI-FR-07', departureTime: '06:30', loadingYard: 'Apapa Yard B', days: [1, 3, 5], note: 'Apapa → Moniya, Mon / Wed / Fri' },
  { trainNumber: 'LI-FR-09', departureTime: '07:15', loadingYard: 'Apapa Yard A', days: [2, 4, 6], note: 'Apapa → Apapa Local, Tue / Thu / Sat' },
  { trainNumber: 'LI-FR-11', departureTime: '06:30', loadingYard: 'Apapa Yard A', days: [1, 2, 3, 4, 5, 6], note: 'Apapa → Ebute Metta, Mon–Sat' },
  { trainNumber: 'LI-FR-12', departureTime: '18:00', loadingYard: 'Apapa Yard C', days: [0, 5], note: 'Apapa → Moniya, evening, Fri / Sun' },
]

export const findTrain = (trainNumber: string): Train | undefined => trains.find((t) => t.trainNumber === trainNumber.trim().toUpperCase())

const addDays = (d: ISODate, n: number): ISODate => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10)

/** Next operating day on or after `from`. */
export function nextDeparture(train: Train, from: ISODate): ISODate {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i)
    if (train.days.includes(new Date(`${d}T12:00:00Z`).getUTCDay())) return d
  }
  return from
}

/** Timetable details for a train number: time, yard, and the next departure on or after `notBefore`. */
export function trainDefaults(trainNumber: string, notBefore: ISODate): { departureDate: ISODate; departureTime: string; loadingYard: string } | null {
  const t = findTrain(trainNumber)
  return t ? { departureDate: nextDeparture(t, notBefore), departureTime: t.departureTime, loadingYard: t.loadingYard } : null
}
