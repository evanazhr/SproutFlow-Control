import { useSyncExternalStore } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  title: string
  description?: string
}

let toasts: ToastItem[] = []
const listeners = new Set<() => void>()
let seq = 0

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(type: ToastType, title: string, description?: string) {
  const item: ToastItem = { id: ++seq, type, title, description }
  toasts = [...toasts, item]
  emit()
  window.setTimeout(() => dismiss(item.id), 5_000)
  return item.id
}

toast.success = (title: string, description?: string) => toast('success', title, description)
toast.error = (title: string, description?: string) => toast('error', title, description)
toast.info = (title: string, description?: string) => toast('info', title, description)

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => [] as ToastItem[],
  )
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

export function Toaster() {
  const items = useToasts()
  if (items.length === 0) return null
  return (
    <div className="toast-stack" aria-live="polite" role="status">
      {items.map((item) => (
        <div key={item.id} className={`toast-item toast-${item.type}`}>
          <span className="toast-icon" aria-hidden="true">
            {ICONS[item.type]}
          </span>
          <div className="toast-body">
            <p className="toast-title">{item.title}</p>
            {item.description ? <p className="toast-desc">{item.description}</p> : null}
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Tutup notifikasi"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
