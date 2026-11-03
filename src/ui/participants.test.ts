import { describe, expect, it } from 'vitest'
import { assignColor, availablePeers, formatName, registerPeer } from './participants'

describe('availablePeers', () => {
  it('provides a friendly name for a peer, stable across calls', () => {
    expect(availablePeers()).toBe(availablePeers())
  })
})

describe('registerPeer', () => {
  it('records a peer with a stable name', () => {
    const name = registerPeer('peer-1')
    const again = registerPeer('peer-1')
    expect(again).toBe(name)
  })
  it('gives different peers different names', () => {
    const a = registerPeer('peer-1')
    const b = registerPeer('peer-2')
    expect(a).not.toBe(b)
  })
})

describe('assignColor', () => {
  it('returns a color for a peer id', () => {
    expect(assignColor('peer-1')).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('is stable for the same peer', () => {
    expect(assignColor('peer-1')).toBe(assignColor('peer-1'))
  })
})

describe('formatName', () => {
  it('formats a raw name nicely', () => {
    expect(formatName('  priya ')).toBe('Priya')
    expect(formatName('mary-jane')).toBe('Mary-Jane')
    expect(formatName('')).toBe('Peer')
  })
})
