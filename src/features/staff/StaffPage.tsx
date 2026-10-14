import { useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldOff, UserCheck, UserCog, X } from 'lucide-react'
import { useStore } from '@/app/store'
import { Notice, PageHeader } from '@/components/ui/blocks'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/fields'
import { Badge, Button, Card, Input, Select, Table, Td, Th } from '@/components/ui/primitives'
import { ReasonDialog } from '@/features/registrations/ReasonDialog'
import { formatDateTime } from '@/lib/format'
import { roleLabels } from '@/lib/permissions'
import { createStaff, reassignStaffRole, resetStaffPassword, setStaffAccess, STAFF_ROLES, updateStaffDetails, type StaffRole } from '@/lib/workflow/staff'
import type { Actor } from '@/lib/workflow/result'
import { DISTRICTS, type District, type StaffAccount, type StaffStatus } from '@/types/domain'

const statusMeta: Record<StaffStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Active', tone: 'success' },
  pending_first_login: { label: 'Pending first login', tone: 'info' },
  suspended: { label: 'Suspended', tone: 'warning' },
  revoked: { label: 'Revoked', tone: 'danger' },
}

type Dlg = { kind: 'create' } | { kind: 'edit' | 'reassign' | 'suspend' | 'reactivate' | 'revoke' | 'reset'; staff: StaffAccount } | null

export function StaffPage() {
  const { data, persona, act } = useStore()
  const [dialog, setDialog] = useState<Dlg>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const actor: Actor = { name: persona.name, role: persona.role }

  const run = (fn: Parameters<typeof act>[0], msg: string): string | null => {
    const r = act(fn)
    if (!r.ok) return r.error
    setFlash(msg)
    return null
  }
  const close = () => setDialog(null)

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="NRC staff credentials. Only Super Admin manages accounts — and has no business approval authority."
        actions={<Button onClick={() => setDialog({ kind: 'create' })}><Plus className="size-4" /> Create account</Button>}
      />
      <div className="mb-4"><Notice title="Simulated credentials">No password is ever generated, shown or emailed. Account changes here do not change the role-switcher personas. Every action is written to the audit log.</Notice></div>
      {flash && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          <p>{flash}</p>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="text-emerald-700"><X className="size-4" /></button>
        </div>
      )}
      <Card>
        <Table>
          <thead><tr><Th>Name</Th><Th>Role</Th><Th>District</Th><Th>Status</Th><Th>Last login</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {data.staff.map((s) => {
              const locked = s.role === 'super_admin' || s.status === 'revoked'
              return (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <Td><p className="font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-500">{s.email}</p></Td>
                  <Td className="whitespace-nowrap">{roleLabels[s.role]}</Td>
                  <Td>{s.district ?? '—'}</Td>
                  <Td><Badge tone={statusMeta[s.status].tone}>{statusMeta[s.status].label}</Badge></Td>
                  <Td className="whitespace-nowrap text-xs">{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : 'Never'}</Td>
                  <Td>
                    {locked ? <span className="text-xs text-slate-400">{s.role === 'super_admin' ? 'Protected' : 'Revoked'}</span> : (
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'edit', staff: s })}><Pencil className="size-3.5" /> Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'reassign', staff: s })}><UserCog className="size-3.5" /> Reassign</Button>
                        {s.status !== 'suspended' && <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'reset', staff: s })}><KeyRound className="size-3.5" /> Reset password</Button>}
                        {s.status === 'suspended'
                          ? <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'reactivate', staff: s })}><UserCheck className="size-3.5" /> Reactivate</Button>
                          : <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'suspend', staff: s })}><ShieldOff className="size-3.5" /> Suspend</Button>}
                        <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setDialog({ kind: 'revoke', staff: s })}>Revoke</Button>
                      </div>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <StaffFormDialog
        mode={dialog?.kind === 'create' ? 'create' : dialog?.kind === 'edit' ? 'edit' : null}
        staff={dialog && 'staff' in dialog ? dialog.staff : undefined}
        onClose={close}
        onSubmit={(v) => dialog?.kind === 'edit'
          ? run((d) => updateStaffDetails(d, dialog.staff.id, v, actor), 'Staff details updated.')
          : run((d) => createStaff(d, v, actor), `Account created for ${v.name}. Initial credentials were emailed (simulated); a password change is forced on first login.`)}
      />
      <ReassignDialog staff={dialog?.kind === 'reassign' ? dialog.staff : null} onClose={close} onSubmit={(role, district, reason) => run((d) => reassignStaffRole(d, (dialog as { staff: StaffAccount }).staff.id, role, district, reason, actor), 'Role reassigned.')} />
      {dialog && 'staff' in dialog && (['suspend', 'reactivate', 'revoke'] as const).map((k) => (
        <ReasonDialog key={k} open={dialog.kind === k} onClose={close} danger={k === 'revoke'}
          title={`${k === 'suspend' ? 'Suspend' : k === 'reactivate' ? 'Reactivate' : 'Revoke'} ${dialog.staff.name}`}
          description={k === 'revoke' ? 'Revoking is permanent: the account can never be reactivated.' : undefined}
          label="Reason" confirmLabel={k === 'suspend' ? 'Suspend access' : k === 'reactivate' ? 'Reactivate access' : 'Revoke access'}
          onConfirm={(r) => run((d) => setStaffAccess(d, dialog.staff.id, k, r, actor), `Access ${k === 'suspend' ? 'suspended' : k === 'reactivate' ? 'reactivated' : 'revoked'} for ${dialog.staff.name}.`)} />
      ))}
      {dialog?.kind === 'reset' && (
        <Dialog open onClose={close} title={`Reset password — ${dialog.staff.name}`} description="Temporary credentials are issued by email (simulated) and the user must change them on next login."
          footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={() => { run((d) => resetStaffPassword(d, dialog.staff.id, actor), `Password reset for ${dialog.staff.name} (email simulated).`); close() }}>Reset password</Button></>} />
      )}
    </>
  )
}

function StaffFormDialog({ mode, staff, onClose, onSubmit }: {
  mode: 'create' | 'edit' | null
  staff?: StaffAccount
  onClose: () => void
  onSubmit: (v: { name: string; email: string; role: StaffRole; district?: District }) => string | null
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('head_of_cargo')
  const [district, setDistrict] = useState<District | ''>('')
  const [error, setError] = useState('')
  const [seedKey, setSeedKey] = useState('')

  // (re)initialise the fields when the dialog opens for a different account
  const key = `${mode}:${staff?.id ?? ''}`
  if (mode && seedKey !== key) {
    setSeedKey(key); setName(staff?.name ?? ''); setEmail(staff?.email ?? ''); setRole((staff?.role as StaffRole) ?? 'head_of_cargo'); setDistrict(staff?.district ?? ''); setError('')
  }
  if (!mode && seedKey) setSeedKey('')

  const submit = () => {
    const err = onSubmit({ name, email, role, district: district || undefined })
    if (err) return setError(err)
    onClose()
  }
  return (
    <Dialog open={!!mode} onClose={onClose} title={mode === 'create' ? 'Create staff account' : 'Edit staff details'} description={mode === 'create' ? 'Initial credentials are issued by email (simulated).' : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>{mode === 'create' ? 'Create account' : 'Save'}</Button></>}>
      <div className="space-y-3">
        <Field label="Full name" required><Input value={name} onChange={(e) => { setName(e.target.value); setError('') }} /></Field>
        <Field label="Email" required><Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /></Field>
        {mode === 'create' && (
          <>
            <Field label="Role" required>
              <Select value={role} onChange={(e) => { setRole(e.target.value as StaffRole); setError('') }}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</Select>
            </Field>
            {role === 'district_supervisor' && (
              <Field label="District" required>
                <Select value={district} onChange={(e) => { setDistrict(e.target.value as District | ''); setError('') }}><option value="">Select…</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</Select>
              </Field>
            )}
          </>
        )}
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Dialog>
  )
}

function ReassignDialog({ staff, onClose, onSubmit }: { staff: StaffAccount | null; onClose: () => void; onSubmit: (role: StaffRole, district: District | undefined, reason: string) => string | null }) {
  const [role, setRole] = useState<StaffRole>('head_of_cargo')
  const [district, setDistrict] = useState<District | ''>('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [seedKey, setSeedKey] = useState('')
  if (staff && seedKey !== staff.id) { setSeedKey(staff.id); setRole(staff.role as StaffRole); setDistrict(staff.district ?? ''); setReason(''); setError('') }
  if (!staff && seedKey) setSeedKey('')

  const submit = () => {
    const err = onSubmit(role, district || undefined, reason)
    if (err) return setError(err)
    onClose()
  }
  return (
    <Dialog open={!!staff} onClose={onClose} title={`Reassign role — ${staff?.name ?? ''}`} description="Use when NRC staff change. The old and new role are recorded in the audit log."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Reassign</Button></>}>
      <div className="space-y-3">
        <Field label="New role" required><Select value={role} onChange={(e) => { setRole(e.target.value as StaffRole); setError('') }}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</Select></Field>
        {role === 'district_supervisor' && (
          <Field label="District" required><Select value={district} onChange={(e) => { setDistrict(e.target.value as District | ''); setError('') }}><option value="">Select…</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
        )}
        <Field label="Reason" required><Input value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} /></Field>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Dialog>
  )
}
