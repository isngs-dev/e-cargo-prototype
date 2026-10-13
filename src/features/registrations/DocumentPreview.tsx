import { FileText } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/primitives'
import { formatDateTime } from '@/lib/format'
import { documentLabels } from '@/lib/registration'
import type { UploadedDocument } from '@/types/domain'

/** Simulated preview: only file name and size are recorded; no file content is stored or transmitted. */
export function DocumentPreview({ doc, onClose }: { doc: UploadedDocument | null; onClose: () => void }) {
  return (
    <Dialog open={!!doc} onClose={onClose} title={doc ? documentLabels[doc.kind] : 'Document'} description="Simulated preview — the file itself is not stored." footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {doc && (
        <div className="space-y-3">
          <div className="mx-auto flex aspect-[3/4] max-h-72 w-52 flex-col rounded border border-slate-300 bg-white p-4 shadow-sm">
            <FileText className="size-6 text-slate-400" aria-hidden />
            <div className="mt-3 space-y-1.5">
              {[90, 70, 85, 60, 80, 50, 75].map((w, i) => <div key={i} className="h-1.5 rounded bg-slate-200" style={{ width: `${w}%` }} />)}
            </div>
            <p className="mt-auto text-center text-[10px] uppercase tracking-wide text-slate-400">Demo preview</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <dt className="text-slate-500">File</dt><dd className="col-span-2 break-all font-medium">{doc.fileName}</dd>
            <dt className="text-slate-500">Size</dt><dd className="col-span-2">{doc.sizeKb} KB</dd>
            <dt className="text-slate-500">Uploaded</dt><dd className="col-span-2">{formatDateTime(doc.uploadedAt)}</dd>
          </dl>
        </div>
      )}
    </Dialog>
  )
}
