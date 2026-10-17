import { useRef, useState } from 'react'
import { Camera, Check, Image as ImageIcon, RotateCcw, Trash2, Upload } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { sampleContainerPhoto, SAMPLE_CAPTIONS } from '@/lib/photos'
import { MAX_PHOTOS, saveContainerPhotos } from '@/lib/workflow/dispatch'
import type { Actor } from '@/lib/workflow/result'
import type { Booking } from '@/types/domain'
import type { Run } from './runTypes'

/** Resize an uploaded picture to a small JPEG so it fits comfortably in this browser's demo storage. */
function toSmallJpeg(file: File, maxSide = 560): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')) }
    img.src = url
  })
}

interface Draft { key: string; fileName: string; dataUrl: string; caption: string }
interface Shown { key: string; src: string; caption: string; meta: string; pending: boolean; savedId?: string }

/**
 * Photos of the containers, taken by the Head of Port during physical verification. Everyone who can see the booking
 * (Facilitator, Director, …) sees them like documents. The Head of Port adds and removes photos freely, and nothing is
 * saved until **Confirm photos** — which records one timeline entry ("2 added, 1 removed").
 */
export function ContainerPhotos({ booking, actor, run, canEdit }: { booking: Booking; actor: Actor; run: Run; canEdit: boolean }) {
  const saved = booking.photos ?? []
  const [added, setAdded] = useState<Draft[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [view, setView] = useState<Shown | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  const shown: Shown[] = [
    ...saved.filter((p) => !removed.includes(p.id)).map((p) => ({ key: p.id, src: p.dataUrl, caption: p.caption, meta: `Added by ${p.addedBy} · ${formatDateTime(p.addedAt)}`, pending: false, savedId: p.id })),
    ...added.map((p) => ({ key: p.key, src: p.dataUrl, caption: p.caption, meta: 'Not saved yet — press Confirm photos', pending: true })),
  ]
  const dirty = added.length > 0 || removed.length > 0
  const full = shown.length >= MAX_PHOTOS

  const addSample = () => {
    const n = shown.length
    setAdded((a) => [...a, { key: `new-${++seq.current}`, fileName: `container_${n + 1}.jpg`, dataUrl: sampleContainerPhoto(n + 1 + seq.current), caption: SAMPLE_CAPTIONS[n % SAMPLE_CAPTIONS.length]! }])
    setError('')
  }
  const upload = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const dataUrl = await toSmallJpeg(f)
      setAdded((a) => [...a, { key: `new-${++seq.current}`, fileName: f.name, dataUrl, caption: 'Container photo' }])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the photo.')
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }
  const remove = (p: Shown) => {
    if (p.savedId) setRemoved((r) => [...r, p.savedId!])
    else setAdded((a) => a.filter((x) => x.key !== p.key))
  }
  const discard = () => { setAdded([]); setRemoved([]); setError('') }
  const confirm = () => {
    const err = run((d) => saveContainerPhotos(d, booking.id, { add: added.map(({ fileName, dataUrl, caption }) => ({ fileName, dataUrl, caption })), removeIds: removed }, actor),
      `Container photos confirmed (${[added.length ? `${added.length} added` : '', removed.length ? `${removed.length} removed` : ''].filter(Boolean).join(', ')}). The Director and the customer can view them.`)
    if (err) return setError(err)
    discard()
  }

  return (
    <Card id="container-photos">
      <CardHeader title="Container photos" description="Taken by the Head of Port during physical verification. Simulated storage — small images only."
        action={canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={addSample} disabled={full}><ImageIcon className="size-3.5" /> Add sample photo</Button>
            <Button size="sm" variant="secondary" onClick={() => file.current?.click()} disabled={busy || full}><Upload className="size-3.5" /> {busy ? 'Adding…' : 'Upload photo'}</Button>
            <Button size="sm" onClick={confirm} disabled={!dirty}><Check className="size-3.5" /> Confirm photos</Button>
            <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} aria-label="Upload container photo" />
          </div>
        )} />
      {error && <p role="alert" className="mx-5 mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {canEdit && dirty && (
        <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Unsaved changes: {[added.length ? `${added.length} added` : '', removed.length ? `${removed.length} removed` : ''].filter(Boolean).join(', ')}. Press <strong>Confirm photos</strong> to record them.</span>
          <button type="button" onClick={discard} className="inline-flex items-center gap-1 text-xs font-medium underline"><RotateCcw className="size-3" /> Discard</button>
        </div>
      )}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-8 text-center text-sm text-slate-500">
          <Camera className="mb-2 size-6 text-slate-400" aria-hidden />
          No photos yet. {canEdit ? 'Add a sample photo or upload one, then press Confirm photos.' : 'The Head of Port adds them during physical verification.'}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {shown.map((p) => (
            <li key={p.key} className={`relative overflow-hidden rounded-md border bg-slate-50 ${p.pending ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'}`}>
              <button type="button" onClick={() => setView(p)} className="block w-full text-left" aria-label={`View photo: ${p.caption}`}>
                <img src={p.src} alt={p.caption} className="aspect-[3/2] w-full object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1.5 text-xs text-slate-600">{p.caption}</span>
              </button>
              {p.pending && <span className="absolute left-1.5 top-1.5"><Badge tone="warning">Not saved</Badge></span>}
              {canEdit && (
                <button type="button" onClick={() => remove(p)} className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-slate-600 shadow hover:text-red-700" aria-label={`Remove photo: ${p.caption}`}><Trash2 className="size-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!view} onClose={() => setView(null)} title={view?.caption ?? 'Photo'} description={view?.meta}>
        {view && <img src={view.src} alt={view.caption} className="max-h-[70vh] w-full rounded-md object-contain" />}
      </Dialog>
    </Card>
  )
}
