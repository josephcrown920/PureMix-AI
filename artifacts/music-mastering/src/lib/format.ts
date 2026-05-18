export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatDate(dateString: string) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date)
}

export function formatTime(ms: number | null | undefined) {
  if (!ms) return '--'
  
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

export const PRESET_LABELS: Record<string, string> = {
  streaming: "Streaming Ready (-14 LUFS)",
  club: "Club / Loud (-7 LUFS)",
  warm_vinyl: "Warm Vinyl (-12 LUFS)",
  broadcast: "Broadcast (-23 LUFS)",
  afrobeats: "Afrobeats (-9 LUFS)",
  hiphop: "Hip-Hop / Trap (-8 LUFS)",
  trap: "Trap / Drill (-8 LUFS)",
  custom: "Custom",
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-muted-foreground/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
}