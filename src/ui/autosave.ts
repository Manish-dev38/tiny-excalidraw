export type SaveStatus = 'saving' | 'saved' | 'error'

export interface AutosaveState {
  status: SaveStatus
  reason?: string
}

export interface AutosaveOptions {
  save(): Promise<void>
  delay?: number
  onStatus?(state: AutosaveState): void
}

export interface Autosave {
  readonly state: AutosaveState
  /** Marks the scene dirty and restarts the debounce. */
  change(): void
  /** Writes immediately, cancelling any pending debounce. */
  flush(): Promise<void>
  dispose(): void
}

const DEFAULT_DELAY = 300

export function createAutosave(options: AutosaveOptions): Autosave {
  const delay = options.delay ?? DEFAULT_DELAY
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let disposed = false
  let state: AutosaveState = { status: 'saved' }

  const emit = (next: AutosaveState) => {
    state = next
    options.onStatus?.({ ...state })
  }

  const run = async (): Promise<void> => {
    if (!dirty || disposed) return
    dirty = false
    emit({ status: 'saving' })
    try {
      await options.save()
      if (!dirty && !disposed) emit({ status: 'saved' })
    } catch (error) {
      dirty = true
      emit({
        status: 'error',
        reason: error instanceof Error ? error.message : 'Could not save this board.',
      })
    }
  }

  return {
    get state() {
      return { ...state }
    },
    change() {
      if (disposed) return
      dirty = true
      emit({ status: 'saving' })
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        void run()
      }, delay)
    },
    async flush() {
      if (disposed) return
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      await run()
    },
    dispose() {
      disposed = true
      if (timer) clearTimeout(timer)
      timer = undefined
    },
  }
}
