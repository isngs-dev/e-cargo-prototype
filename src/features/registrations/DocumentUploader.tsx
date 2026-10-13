import { useRef, useState } from 'react'
import { CircleCheck, Eye, FileUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { documentLabels } from '@/lib/registration'
import type { DocumentKind, UploadedDocument } from '@/types/domain'
import { DocumentPreview } from './DocumentPreview'

const MAX_KB = 5 * 1024

/** Simulated upload control: records file name and size only. */
export function DocumentUploader({ kind, required, doc, onChange }: { kind: DocumentKind; required: boolean; doc?: UploadedDocument; onChange: (doc: UploadedDocument | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<UploadedDocument | null>(null)

  const set = (fileName: string, sizeKb: number) =>
    onChange({ id: `doc-${Date.now()}-${kind}`, kind, fileName, sizeKb, uploadedAt: new Date().toISOString() })

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) return setError('Only PDF, PNG or JPG files are accepted.')
    const kb = Math.max(1, Math.round(f.size / 1024))
    if (kb > MAX_KB) return setError('File is larger than 5 MB.')
    setError('')
    set(f.name, kb)
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {documentLabels[kind]} {required ? <span className="text-red-600" aria-hidden>*</span> : <span className="text-xs font-normal text-slate-500">(optional)</span>}
          </p>
          {doc ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700"><CircleCheck className="size-3.5" /> {doc.fileName} · {doc.sizeKb} KB</p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">PDF, PNG or JPG · max 5 MB</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {doc && <Button size="sm" variant="secondary" onClick={() => setPreview(doc)}><Eye className="size-3.5" /> View</Button>}
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()}><FileUp className="size-3.5" /> {doc ? 'Re-upload' : 'Choose file'}</Button>
          {!doc && <Button size="sm" variant="ghost" onClick={() => set(`${kind}_sample.pdf`, 420)} title="Attach a simulated sample file">Use sample file</Button>}
          {doc && !required && <Button size="sm" variant="ghost" onClick={() => onChange(undefined)} aria-label={`Remove ${documentLabels[kind]}`}><Trash2 className="size-3.5" /></Button>}
        </div>
      </div>
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" aria-label={`Upload ${documentLabels[kind]}`} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
