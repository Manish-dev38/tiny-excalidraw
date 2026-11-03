import { describe, expect, it } from 'vitest'
import { buildRoomUrl, generateRoomId, parseRoomFromHash } from './room'

describe('generateRoomId', () => {
  it('returns an 8-character alphanumeric id', () => {
    expect(generateRoomId()).toMatch(/^[a-z0-9]{8}$/)
  })
  it('produces distinct ids across calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20; i++) seen.add(generateRoomId())
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('parseRoomFromHash', () => {
  it('extracts a room id from a hash', () => {
    expect(parseRoomFromHash('#room=abc123')).toBe('abc123')
  })
  it('decodes URL-encoded ids', () => {
    expect(parseRoomFromHash('#room=abc%20def')).toBe('abc def')
  })
  it('returns null when no room param is present', () => {
    expect(parseRoomFromHash('')).toBeNull()
    expect(parseRoomFromHash('#foo=bar')).toBeNull()
    expect(parseRoomFromHash('#room=')).toBeNull()
  })
})

describe('buildRoomUrl', () => {
  it('builds a shareable URL from an origin and room id', () => {
    expect(buildRoomUrl('abc123', 'https://example.com')).toBe(
      'https://example.com#room=abc123',
    )
  })
})
