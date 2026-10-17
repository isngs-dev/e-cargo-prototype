import { describe, expect, it } from 'vitest'
import { createSeedData } from '@/app/state'
import { personas } from '@/data/personas'
import { demoRegistration } from '@/features/registrations/RegistrationForm'
import { addressesOf, buildMail, isMailable, emptyMailState, envelope, inboxFor, isCopy, isRecipient, isUnread, mailboxes, mailboxMessages, mailSignIn, recipientLabel, SYSTEM_ADDRESS } from '@/lib/mail'
import { authenticateCustomer } from '@/lib/auth'
import { saveContainerPhotos } from '@/lib/workflow/dispatch'
import { directorApprove, districtForward, submitRegistration } from '@/lib/workflow/registration'
import type { Persona } from '@/types/domain'

const persona = (id: string): Persona => personas.find((p) => p.id === id)!
const reader = (id: string, applicantAppId = '') => ({ persona: persona(id), applicantAppId })
const doc = (kind: 'cac_certificate' | 'company_profile') => ({ id: `d-${kind}`, kind, fileName: `${kind}.pdf`, sizeKb: 1, uploadedAt: '2026-10-14T09:00:00+01:00' })

function withNewApplication() {
  const d0 = createSeedData()
  const sub = submitRegistration(d0, { ...demoRegistration(), documents: [doc('cac_certificate'), doc('company_profile')] }, { name: 'Zainab Lawal', role: 'cargo_facilitator' }, '2099-01-01T09:00:00+01:00')
  if (!sub.ok) throw new Error(sub.error)
  return { data: sub.data, appId: (sub as unknown as { applicationId: string }).applicationId }
}

describe('simulated mail is derived from the audit log', () => {
  const data = createSeedData()
  const mail = buildMail(data)
  it('covers business stages only, with unique ids, newest first', () => {
    expect(mail.length).toBeGreaterThan(50)
    expect(new Set(mail.map((m) => m.id)).size).toBe(mail.length)
    expect(mail.some((m) => ['staff', 'master_data', 'system'].includes(m.entityType))).toBe(false)
    for (let i = 1; i < mail.length; i++) expect(Date.parse(mail[i - 1]!.at)).toBeGreaterThanOrEqual(Date.parse(mail[i]!.at))
  })
  it('the Managing Director and the Director receive every message (addressed or copied), once — except private welcome emails', () => {
    for (const m of mail.filter((x) => !x.id.endsWith('-welcome'))) {
      expect([...m.to, ...m.cc].some((r) => isRecipient(r, reader('p-md')))).toBe(true)
      expect([...m.to, ...m.cc].some((r) => isRecipient(r, reader('p-dir')))).toBe(true)
      const labels = [...m.to, ...m.cc].map((r) => recipientLabel(r, data))
      expect(new Set(labels).size).toBe(labels.length)
    }
    const shared = mail.filter((x) => !x.id.endsWith('-welcome')).length
    expect(inboxFor(mail, reader('p-md')).length).toBe(shared)
    expect(inboxFor(mail, reader('p-dir')).length).toBe(shared)
    for (const w of mail.filter((x) => x.id.endsWith('-welcome'))) expect(w.cc).toEqual([])
  })
  it('Super Admin’s outbox is every message; the Super Admin inbox is only what is addressed to that role', () => {
    const welcomes = mail.filter((x) => x.id.endsWith('-welcome')).length
    expect(mail.length - welcomes).toBe(data.audit.filter(isMailable).length)
    expect(mailboxMessages(mail, SYSTEM_ADDRESS, data)).toHaveLength(mail.length)
    expect(inboxFor(mail, reader('p-sa')).length).toBeLessThan(mail.length)
  })
  it('an AWB goes to the customer, Head of Cargo, Director and Head of Port, with the MD copied', () => {
    const awb = mail.find((m) => m.entityType === 'booking' && m.subject.includes('AWB') && m.entityId === 'bk-0390')!
    expect(awb).toBeTruthy()
    const who = (id: string) => isRecipient(awb.to[0]!, reader(id)) || awb.to.some((r) => isRecipient(r, reader(id)))
    expect(awb.to.some((r) => isRecipient(r, reader('p-hoc')))).toBe(true)
    expect(awb.to.some((r) => isRecipient(r, reader('p-hop')))).toBe(true)
    expect(awb.to.some((r) => isRecipient(r, reader('p-dir')))).toBe(true)
    expect(awb.to.some((r) => r.kind === 'customer' && r.customerId === 'cus-fgra')).toBe(true)
    expect(awb.cc).toEqual([{ kind: 'role', role: 'managing_director' }])
    expect(who('p-ds')).toBe(false)
  })
  it('customers only see their own company’s mail', () => {
    const adaeze = inboxFor(mail, reader('p-fac-priority'))
    const ibrahim = inboxFor(mail, reader('p-fac-standard'))
    expect(adaeze.length).toBeGreaterThan(0)
    for (const m of adaeze) expect(m.to.some((r) => r.kind === 'customer' && r.customerId === 'cus-lagoon')).toBe(true)
    for (const m of ibrahim) expect(m.to.some((r) => r.kind === 'customer' && r.customerId === 'cus-gateway')).toBe(true)
    expect(adaeze.some((m) => ibrahim.includes(m))).toBe(false)
  })
  it('District Supervisors only get their own district’s registrations', () => {
    const lagos = inboxFor(mail, reader('p-ds')).filter((m) => m.entityType === 'registration')
    const ibadan = inboxFor(mail, reader('p-ds-ibadan')).filter((m) => m.entityType === 'registration')
    expect(lagos.length).toBeGreaterThan(0)
    expect(ibadan.length).toBeGreaterThan(0)
    for (const m of lagos) expect(data.applications.find((a) => a.id === m.entityId)!.district).toBe('Lagos')
    for (const m of ibadan) expect(data.applications.find((a) => a.id === m.entityId)!.district).toBe('Ibadan')
  })
})

describe('the new-company journey produces mail at every stage', () => {
  it('applicant confirmation, supervisor task, Director task, approval — each to the right people', () => {
    const { data: d1, appId } = withNewApplication()
    const sub = buildMail(d1).find((m) => m.entityId === appId)!
    expect(sub.to.some((r) => r.kind === 'applicant' && r.appId === appId)).toBe(true)
    expect(inboxFor([sub], reader('p-fac-applicant', appId))).toHaveLength(1)
    expect(inboxFor([sub], reader('p-fac-priority'))).toHaveLength(0)
    expect(inboxFor([sub], reader('p-ds'))).toHaveLength(1)
    expect(isCopy(sub, reader('p-ds'))).toBe(false)
    expect(inboxFor([sub], reader('p-ds-ibadan'))).toHaveLength(0)
    expect(isCopy(sub, reader('p-md'))).toBe(true)

    const fwd = districtForward(d1, appId, { name: 'Chukwuemeka Obi', role: 'district_supervisor', district: 'Lagos' }, '', '2099-01-01T10:00:00+01:00')
    if (!fwd.ok) throw new Error(fwd.error)
    const forwarded = buildMail(fwd.data).find((m) => m.entityId === appId && m.subject.includes('forwarded'))!
    expect(forwarded.to.some((r) => isRecipient(r, reader('p-dir')))).toBe(true)

    const ok = directorApprove(fwd.data, appId, { name: 'Aliyu Bello', role: 'director_operations' }, { isPriority: true, discountPct: 10, creditMonths: 2, thresholdNaira: 5_000_000, category: 'Strategic' }, '', '2099-01-01T11:00:00+01:00')
    if (!ok.ok) throw new Error(ok.error)
    const welcome = buildMail(ok.data).find((m) => m.entityId === appId && m.id.endsWith('-welcome'))!
    expect(welcome.to).toEqual([{ kind: 'applicant', appId }])
    expect(welcome.cc).toEqual([])
    const customer = ok.data.customers.find((c) => c.companyName === 'Harbour Link Logistics Ltd')!
    expect(welcome.body.some((l) => l === `Sign-in email: ${customer.poc.email}`)).toBe(true)
    expect(welcome.body.some((l) => l.startsWith('Username'))).toBe(false)
    // the username in the email really signs in (as the new company's facilitator)
    expect(authenticateCustomer(customer.username, 'demo1234', ok.data, appId)).toBe('p-fac-applicant')
    expect(authenticateCustomer(customer.username, 'wrong', ok.data, appId)).toBeNull()
    // the record copy goes to the supervisor, with MD and Director copied; the applicant gets only the welcome
    const record = buildMail(ok.data).find((m) => m.entityId === appId && /approved/i.test(m.subject) && !m.id.endsWith('-welcome'))!
    expect(record.to.some((r) => r.kind === 'applicant')).toBe(false)
    // the applicant's own mailbox (whatever email they typed) holds their mail
    const box = mailboxMessages(buildMail(ok.data), 'zainab.lawal@harbourlink.demo', ok.data)
    expect(box.some((m) => m.id.endsWith('-welcome'))).toBe(true)
    expect(mailboxes(ok.data, appId).some((b) => b.email === 'zainab.lawal@harbourlink.demo')).toBe(true)
  })
})

describe('unread state', () => {
  const epoch = '2026-10-14T12:00:00.000Z'
  const base = { id: 'm1', at: '2026-10-14T12:00:00.000Z', entityType: 'booking' as const, entityId: 'b', entityRef: 'r', subject: 's', body: [], to: [], cc: [], actorName: 'a' }
  it('history is read; new mail is unread until opened or marked all read, per account', () => {
    const s = emptyMailState(epoch)
    const old = { ...base, id: 'old', at: '2026-10-01T09:00:00.000Z' }
    const fresh = { ...base, id: 'new', at: '2026-10-15T09:00:00.000Z' }
    expect(isUnread(old, 'p-dir', s)).toBe(false)
    expect(isUnread(fresh, 'p-dir', s)).toBe(true)
    const opened = { ...s, read: { 'p-dir': ['new'] } }
    expect(isUnread(fresh, 'p-dir', opened)).toBe(false)
    expect(isUnread(fresh, 'p-md', opened)).toBe(true)
    const seen = { ...s, seenUntil: { 'p-md': '2026-10-16T00:00:00.000Z' } }
    expect(isUnread(fresh, 'p-md', seen)).toBe(false)
    expect(isUnread(fresh, 'p-dir', seen)).toBe(true)
  })
})

describe('Mail Outbox addresses and sign-in', () => {
  const data = createSeedData()
  const mail = buildMail(data)
  it('resolves roles to active staff addresses (by district), customers to their contact email', () => {
    expect(addressesOf({ kind: 'role', role: 'district_supervisor', district: 'Lagos' }, data).map((a) => a.email)).toEqual(['c.obi@nrc.demo'])
    expect(addressesOf({ kind: 'role', role: 'managing_director' }, data).map((a) => a.email)).toEqual(['n.adekunle@nrc.demo'])
    expect(addressesOf({ kind: 'customer', customerId: 'cus-lagoon' }, data).map((a) => a.email)).toEqual(['adaeze.okafor@lagoonfreight.demo'])
  })
  it('an envelope never lists the same address twice and puts nobody in both To and Cc', () => {
    for (const m of mail) {
      const env = envelope(m, data)
      const all = [...env.to, ...env.cc].map((a) => a.email)
      expect(new Set(all).size).toBe(all.length)
    }
  })
  it('each mailbox holds only mail addressed or copied to it; the system mailbox holds everything sent', () => {
    const adaeze = mailboxMessages(mail, 'adaeze.okafor@lagoonfreight.demo', data)
    expect(adaeze.length).toBeGreaterThan(0)
    for (const m of adaeze) expect([...envelope(m, data).to, ...envelope(m, data).cc].some((a) => a.email === 'adaeze.okafor@lagoonfreight.demo')).toBe(true)
    expect(mailboxMessages(mail, 'n.adekunle@nrc.demo', data).length).toBe(mail.filter((m) => !m.id.endsWith('-welcome')).length)
  })
  it('lists staff, the two demo customers and the system mailbox; signs in only known addresses with the demo password', () => {
    const boxes = mailboxes(data, '')
    expect(boxes.some((b) => b.email === SYSTEM_ADDRESS)).toBe(true)
    expect(boxes.filter((b) => b.group === 'Customers').map((b) => b.email)).toEqual(['adaeze.okafor@lagoonfreight.demo', 'i.musa@apapagateway.demo'])
    expect(boxes.some((b) => b.email === 'h.garba@nrc.demo')).toBe(false) // suspended staff
    expect(mailSignIn('A.Bello@NRC.demo', 'demo1234', data, '')).toBe('a.bello@nrc.demo')
    expect(mailSignIn('a.bello@nrc.demo', 'nope', data, '')).toBeNull()
    expect(mailSignIn('stranger@example.com', 'demo1234', data, '')).toBeNull()
  })
})

describe('mail carries stages, not routine detail', () => {
  it('container photos, internal remarks and pricing detail never produce email; status changes and security notices do', () => {
    const base = { id: 'au-x', at: '2026-10-14T10:00:00+01:00', actorName: 'Grace Etim', actorRole: 'head_port_operations' as const, entityType: 'booking' as const, entityId: 'bk-0398', entityRef: 'NRC-BK-2026-0398' }
    for (const action of ['Container photo added (2 on file)', 'Container photo removed (1 on file)', 'Payment terms selected', 'Discount granted below eligible maximum', 'Internal remark added', 'Invoice generated; payment link issued (simulated)'])
      expect(isMailable({ ...base, action })).toBe(false)
    expect(isMailable({ ...base, action: 'Physical verification passed; AWB generated', toStatus: 'awb_generated' })).toBe(true)
    expect(isMailable({ ...base, action: 'Payment reminder sent (24h, simulated)' })).toBe(true)
    expect(isMailable({ ...base, entityType: 'customer', action: 'Password changed at first sign-in (simulated)' })).toBe(true)
    expect(isMailable({ ...base, entityType: 'staff', action: 'Staff account created', toStatus: 'pending_first_login' })).toBe(false)
  })
  it('no mailbox has a photo email, after a photo is actually added', () => {
    const d = createSeedData()
    const r = saveContainerPhotos(d, 'bk-0398', { add: [{ fileName: 'a.jpg', dataUrl: 'data:image/jpeg;base64,AAAA', caption: 'x' }], removeIds: [] }, { name: 'Grace Etim', role: 'head_port_operations' })
    if (!r.ok) throw new Error(r.error)
    expect(buildMail(r.data).some((m) => /photo/i.test(m.subject))).toBe(false)
    expect(r.data.audit.at(-1)!.action).toContain('Container photo') // still on the audit record
  })
})
