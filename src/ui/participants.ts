import { USER_COLORS } from './palette'

const ADJECTIVES = ['Swift', 'Bright', 'Calm', 'Bold', 'Mellow', 'Nimble', 'Lively', 'Quiet', 'Sunny', 'Kind']
const ANIMALS = ['Otter', 'Fox', 'Heron', 'Panda', 'Koala', 'Badger', 'Dove', 'Lynx', 'Wren', 'Seal']

let counter = 0
let myName: string | null = null

/** A stable, friendly display name for this session's own user. */
export function availablePeers(): string {
  if (!myName) {
    myName = `${ADJECTIVES[counter % ADJECTIVES.length]} ${ANIMALS[counter % ANIMALS.length]}`
  }
  return myName
}

const registry = new Map<string, string>()

/** Registers a remote peer id and returns its (stable) display name. */
export function registerPeer(peerId: string): string {
  let name = registry.get(peerId)
  if (!name) {
    counter += 1
    name = `${ADJECTIVES[counter % ADJECTIVES.length]} ${ANIMALS[counter % ANIMALS.length]}`
    registry.set(peerId, name)
  }
  return name
}

export function assignColor(peerId: string): string {
  let hash = 0
  for (let i = 0; i < peerId.length; i++) {
    hash = (hash * 31 + peerId.charCodeAt(i)) | 0
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

export function formatName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'Peer'
  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join('-')
}
