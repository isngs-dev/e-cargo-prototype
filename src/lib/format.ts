const dt = new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' })
const dOnly = new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })

export const formatDateTime = (iso: string) => dt.format(new Date(iso))
export const formatDate = (iso: string) => dOnly.format(new Date(iso.length === 10 ? `${iso}T12:00:00+01:00` : iso))
