import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Field, Textarea } from '@/components/ui/fields'
import { Button } from '@/components/ui/primitives'

/** Confirmation dialog collecting remarks. `onConfirm` returns an error string to keep the dialog open. */
export function ReasonDialog({
  open, onClose, title, description, label = 'Remarks', required = true, confirmLabel, danger, onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  label?: string
  required?: boolean
  confirmLabel: string
  danger?: boolean
  onConfirm: (remarks: string) => string | null
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const close = () => { setText(''); setError(''); onClose() }
  const confirm = () => {
    if (required && !text.trim()) return setError('Remarks are required.')
    const err = onConfirm(text)
    if (err) return setError(err)
    close()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={confirm}>{confirmLabel}</Button>
        </>
      }
    >
      <Field label={label} required={required} error={error}>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); setError('') }} placeholder="Write a clear reason…" />
      </Field>
    </Dialog>
  )
}
