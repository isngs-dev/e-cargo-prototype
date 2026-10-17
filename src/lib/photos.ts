/** Built-in sample container photos (SVG), so the demo needs no image files. Illustrative only — not real photographs. */

const COLOURS = ['#b91c1c', '#1d4ed8', '#047857', '#b45309', '#475569', '#7c3aed']

export const SAMPLE_CAPTIONS = [
  'Containers on the loading bay — front view',
  'Container seals checked and intact',
  'Containers loaded on wagons — side view',
  'Door end of the container — seal number visible',
]

/** A simple container-yard scene as a data URL. `n` varies colour, layout and number. */
export function sampleContainerPhoto(n: number, label = 'NRCU'): string {
  const c = COLOURS[n % COLOURS.length]!
  const c2 = COLOURS[(n + 2) % COLOURS.length]!
  const num = String(4_820_100 + n * 137).slice(-7)
  const ribs = Array.from({ length: 14 }, (_, i) => `<line x1="${112 + i * 22}" y1="148" x2="${112 + i * 22}" y2="262" stroke="rgba(0,0,0,.22)" stroke-width="3"/>`).join('')
  const ribs2 = Array.from({ length: 9 }, (_, i) => `<line x1="${392 + i * 22}" y1="170" x2="${392 + i * 22}" y2="262" stroke="rgba(0,0,0,.22)" stroke-width="3"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
<rect width="640" height="400" fill="#bfdbfe"/><rect y="250" width="640" height="150" fill="#9ca3af"/><rect y="262" width="640" height="10" fill="#6b7280"/>
<rect x="100" y="140" width="300" height="122" rx="3" fill="${c}"/>${ribs}
<rect x="380" y="164" width="190" height="98" rx="3" fill="${c2}"/>${ribs2}
<rect x="100" y="140" width="300" height="10" fill="rgba(255,255,255,.18)"/>
<text x="118" y="132" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#1e293b">${label} ${num} 0</text>
<rect x="120" y="268" width="440" height="8" fill="#374151"/><circle cx="170" cy="288" r="14" fill="#1f2937"/><circle cx="270" cy="288" r="14" fill="#1f2937"/><circle cx="430" cy="288" r="14" fill="#1f2937"/><circle cx="520" cy="288" r="14" fill="#1f2937"/>
<line x1="0" y1="300" x2="640" y2="300" stroke="#4b5563" stroke-width="4"/><line x1="0" y1="330" x2="640" y2="330" stroke="#4b5563" stroke-width="4"/>
<rect x="296" y="196" width="26" height="14" rx="2" fill="#fbbf24"/><text x="309" y="207" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#1f2937">SEAL</text>
<text x="16" y="386" font-family="Arial,sans-serif" font-size="12" fill="#374151">Sample image — illustrative only</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
