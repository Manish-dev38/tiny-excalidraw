// Ambiguity-free alphabet: no 0/O, 1/l/I.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'
const ROOM_LENGTH = 8

export function generateRoomId(): string {
  let out = ''
  for (let i = 0; i < ROOM_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

export function parseRoomFromHash(hash: string): string | null {
  const match = hash.match(/[#&]room=([^&#]+)/)
  if (!match || !match[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export function defaultOrigin(): string {
  const location = globalThis.location as Location | undefined
  return location ? location.origin : ''
}

export function buildRoomUrl(id: string, origin: string = defaultOrigin()): string {
  return `${origin}#room=${encodeURIComponent(id)}`
}
