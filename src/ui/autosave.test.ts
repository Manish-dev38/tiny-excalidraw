import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, type AutosaveState } from './autosave'

describe('createAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces changes and reports saving then saved', async () => {
    const save = vi.fn(async () => {})
    const states: AutosaveState[] = []
    const autosave = createAutosave({ save, onStatus: (s) => states.push(s) })

    autosave.change()
    expect(autosave.state.status).toBe('saving')
    await vi.advanceTimersByTimeAsync(299)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(autosave.state.status).toBe('saved')
    expect(states.map((s) => s.status)).toContain('saving')
  })

  it('restarts the debounce on every change', async () => {
    const save = vi.fn(async () => {})
    const autosave = createAutosave({ save })

    autosave.change()
    await vi.advanceTimersByTimeAsync(200)
    autosave.change()
    await vi.advanceTimersByTimeAsync(200)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('reports a failure and retries on the next change', async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Quota exceeded'))
      .mockResolvedValueOnce(undefined)
    const autosave = createAutosave({ save })

    autosave.change()
    await vi.advanceTimersByTimeAsync(300)
    expect(autosave.state).toEqual({ status: 'error', reason: 'Quota exceeded' })

    autosave.change()
    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(2)
    expect(autosave.state.status).toBe('saved')
  })

  it('flushes immediately and cancels the pending debounce', async () => {
    const save = vi.fn(async () => {})
    const autosave = createAutosave({ save })

    autosave.change()
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(autosave.state.status).toBe('saved')

    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not write when there is nothing pending', async () => {
    const save = vi.fn(async () => {})
    const autosave = createAutosave({ save })
    await autosave.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('retries a failed write on flush', async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Busy'))
      .mockResolvedValueOnce(undefined)
    const autosave = createAutosave({ save })

    autosave.change()
    await vi.advanceTimersByTimeAsync(300)
    expect(autosave.state.status).toBe('error')

    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(autosave.state.status).toBe('saved')
  })
})
