import Peer, { type DataConnection } from 'peerjs'
import { decodeMessage, encodeMessage, type ClientMessage } from './protocol'

export type SessionRole = 'host' | 'client' | 'none'
export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface PeerSession {
  readonly role: SessionRole
  readonly status: SessionStatus
  send(msg: ClientMessage): void
  close(): void
}

export interface PeerCallbacks {
  onMessage(msg: ClientMessage): void
  onStatus(role: SessionRole, status: SessionStatus): void
  /** A remote peer connected (host uses this to send a scene snapshot). */
  onConnected(role: SessionRole): void
}

function peerIdForRoom(roomId: string): string {
  return `tiny-excalidraw-${roomId}`
}

export function startPeerSession(roomId: string, cb: PeerCallbacks): PeerSession {
  let peer: Peer | null = null
  let conn: DataConnection | null = null
  let role: SessionRole = 'none'
  let status: SessionStatus = 'idle'
  let closed = false

  const setStatus = (r: SessionRole, s: SessionStatus) => {
    role = r
    status = s
    if (!closed) cb.onStatus(r, s)
  }

  const handleConn = (c: DataConnection) => {
    conn = c
    c.on('open', () => {
      setStatus(role, 'connected')
      cb.onConnected(role)
    })
    c.on('data', (raw) => {
      try {
        cb.onMessage(decodeMessage(raw as string))
      } catch {
        /* ignore malformed frames */
      }
    })
    c.on('close', () => setStatus(role, 'connecting'))
    c.on('error', () => setStatus(role, 'connecting'))
  }

  const joinAsClient = () => {
    setStatus('client', 'connecting')
    const p = new Peer()
    peer = p
    p.on('open', () => {
      if (closed) return
      const c = p.connect(peerIdForRoom(roomId), { reliable: true })
      handleConn(c)
    })
    p.on('error', (err) => {
      if (err.type === 'peer-unavailable') setStatus('client', 'error')
    })
  }

  // Attempt host first; fall back to joining if the id is taken.
  setStatus('host', 'connecting')
  const p = new Peer(peerIdForRoom(roomId))
  peer = p
  p.on('connection', handleConn)
  p.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      try {
        p.destroy()
      } catch {
        /* noop */
      }
      joinAsClient()
    }
  })

  return {
    get role() {
      return role
    },
    get status() {
      return status
    },
    send(msg) {
      if (conn && conn.open) conn.send(encodeMessage(msg))
    },
    close() {
      closed = true
      try {
        conn?.close()
      } catch {
        /* noop */
      }
      try {
        peer?.destroy()
      } catch {
        /* noop */
      }
    },
  }
}
