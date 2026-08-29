import { Bell, CalendarClock, CheckCheck, Trash2, X } from 'lucide-react'
import { SpenzaData } from '../lib/db'

type Props = {
  data: SpenzaData
  setData: React.Dispatch<React.SetStateAction<SpenzaData>>
  open: boolean
  onClose: () => void
}
type Notice = {
  id: string
  title: string
  message: string
  date: string
  kind: 'overdue' | 'due' | 'paid'
}

const today = () => new Date().toISOString().slice(0, 10)
const dayDiff = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000,
  )

export function buildNotifications(data: SpenzaData): Notice[] {
  const now = today()
  const notices: Notice[] = []
  data.bills.forEach((b) => {
    const oneTimePaid = b.recurrence === 'once' && !!b.lastPaidDate
    if (!oneTimePaid) {
      const diff = dayDiff(now, b.dueDate)
      if (diff < 0)
        notices.push({
          id: `${b.id}:overdue:${b.dueDate}`,
          title: `${b.name} is overdue`,
          message: `Due ${new Date(`${b.dueDate}T12:00:00`).toLocaleDateString()}`,
          date: b.dueDate,
          kind: 'overdue',
        })
      else if (diff <= b.reminderDays)
        notices.push({
          id: `${b.id}:due:${b.dueDate}`,
          title: diff === 0 ? `${b.name} is due today` : `${b.name} is due soon`,
          message:
            diff === 0 ? 'Payment is due today.' : `Due in ${diff} day${diff === 1 ? '' : 's'}.`,
          date: b.dueDate,
          kind: 'due',
        })
    }
    if (b.lastPaidDate && dayDiff(b.lastPaidDate, now) <= 14)
      notices.push({
        id: `${b.id}:paid:${b.lastPaidDate}`,
        title: `${b.name} paid`,
        message: `Marked paid on ${new Date(`${b.lastPaidDate}T12:00:00`).toLocaleDateString()}.`,
        date: b.lastPaidDate,
        kind: 'paid',
      })
  })
  return notices.sort((a, b) => b.date.localeCompare(a.date))
}

export function NotificationBell({ data, onClick }: { data: SpenzaData; onClick: () => void }) {
  const dismissed = new Set(data.notificationDismissedIds || []),
    read = new Set(data.notificationReadIds || [])
  const unread = buildNotifications(data).filter(
    (n) => !dismissed.has(n.id) && !read.has(n.id),
  ).length
  return (
    <button className="round notificationBell" aria-label="Notifications" onClick={onClick}>
      <Bell size={18} />
      {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}

export default function NotificationCenter({ data, setData, open, onClose }: Props) {
  if (!open) return null
  const dismissed = new Set(data.notificationDismissedIds || []),
    read = new Set(data.notificationReadIds || [])
  const notices = buildNotifications(data).filter((n) => !dismissed.has(n.id))
  const markRead = (id: string) =>
    setData((d) => ({
      ...d,
      notificationReadIds: Array.from(new Set([...(d.notificationReadIds || []), id])),
    }))
  const dismiss = (id: string) =>
    setData((d) => ({
      ...d,
      notificationDismissedIds: Array.from(new Set([...(d.notificationDismissedIds || []), id])),
    }))
  const readAll = () =>
    setData((d) => ({
      ...d,
      notificationReadIds: Array.from(
        new Set([...(d.notificationReadIds || []), ...notices.map((n) => n.id)]),
      ),
    }))
  const clearAll = () =>
    setData((d) => ({
      ...d,
      notificationDismissedIds: Array.from(
        new Set([...(d.notificationDismissedIds || []), ...notices.map((n) => n.id)]),
      ),
    }))
  return (
    <div className="notificationOverlay" onClick={onClose}>
      <section className="notificationPanel" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">SPENZA</span>
            <h2>Notifications</h2>
          </div>
          <button className="close" onClick={onClose}>
            <X />
          </button>
        </header>
        {notices.length > 0 && (
          <div className="notificationTools">
            <button onClick={readAll}>
              <CheckCheck /> Mark all read
            </button>
            <button onClick={clearAll}>
              <Trash2 /> Clear all
            </button>
          </div>
        )}
        <div className="notificationList">
          {notices.map((n) => (
            <article
              key={n.id}
              className={`notificationItem ${read.has(n.id) ? 'read' : ''} ${n.kind}`}
              onClick={() => markRead(n.id)}
            >
              <div className="notificationIcon">
                <CalendarClock />
              </div>
              <div>
                <b>{n.title}</b>
                <p>{n.message}</p>
              </div>
              <button
                className="notificationDismiss"
                onClick={(e) => {
                  e.stopPropagation()
                  dismiss(n.id)
                }}
                aria-label="Clear notification"
              >
                <X />
              </button>
            </article>
          ))}
          {!notices.length && (
            <div className="notificationEmpty">
              <Bell />
              <b>You're all caught up</b>
              <span>Bill reminders and other Spenza alerts will appear here.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
