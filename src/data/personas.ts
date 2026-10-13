import type { Persona } from '@/types/domain'

/**
 * Demonstration personas for the role switcher. This is NOT authentication.
 * All names are fictional demo identities.
 */
export const personas: Persona[] = [
  { id: 'p-fac-priority', name: 'Adaeze Okafor', role: 'cargo_facilitator', title: 'Lagoon Freight & Logistics Ltd · Priority', customerId: 'cus-lagoon' },
  { id: 'p-fac-standard', name: 'Ibrahim Musa', role: 'cargo_facilitator', title: 'Apapa Gateway Clearing Services Ltd · Non-Priority', customerId: 'cus-gateway' },
  { id: 'p-ds', name: 'Chukwuemeka Obi', role: 'district_supervisor', title: 'District Supervisor, Lagos District' },
  { id: 'p-hoc', name: 'Funmilayo Adebayo', role: 'head_of_cargo', title: 'Head of Cargo' },
  { id: 'p-dir', name: 'Aliyu Bello', role: 'director_operations', title: 'Director of Operations, NRC HQ' },
  { id: 'p-hop', name: 'Grace Etim', role: 'head_port_operations', title: 'Head of Port Operations, Apapa' },
  { id: 'p-sa', name: 'Tunde Bakare', role: 'super_admin', title: 'Super Admin · Service Provider' },
]

export const DEFAULT_PERSONA_ID = 'p-fac-priority'

export function findPersona(id: string): Persona {
  return personas.find((p) => p.id === id) ?? personas[0]!
}
