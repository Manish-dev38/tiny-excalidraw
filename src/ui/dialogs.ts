interface DialogOptions {
  title: string
  body: string
  confirmLabel?: string
  /** `null` renders a single-action dialog. */
  cancelLabel?: string | null
  danger?: boolean
}

function openDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'app-dialog'

    const title = document.createElement('h2')
    title.className = 'dialog-title'
    title.textContent = options.title

    const body = document.createElement('p')
    body.className = 'dialog-body'
    body.textContent = options.body

    const actions = document.createElement('div')
    actions.className = 'dialog-actions'

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'dialog-btn'
    cancel.textContent = options.cancelLabel ?? 'Cancel'
    cancel.addEventListener('click', () => dialog.close('cancel'))

    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = `dialog-btn primary${options.danger ? ' danger' : ''}`
    confirm.textContent = options.confirmLabel ?? 'OK'
    confirm.addEventListener('click', () => dialog.close('confirm'))

    if (options.cancelLabel !== null) actions.appendChild(cancel)
    actions.appendChild(confirm)
    dialog.append(title, body, actions)
    document.body.appendChild(dialog)

    dialog.addEventListener('close', () => {
      const accepted = dialog.returnValue === 'confirm'
      dialog.remove()
      resolve(accepted)
    })

    dialog.showModal()
    if (options.cancelLabel !== null) cancel.focus()
    else confirm.focus()
  })
}

export function confirmReplaceBoard(): Promise<boolean> {
  return openDialog({
    title: 'Replace this board?',
    body: "Importing will replace the current drawing for everyone in this room. You can't undo this.",
    confirmLabel: 'Replace board',
    cancelLabel: 'Cancel',
    danger: true,
  })
}

export function showImportError(reason: string): Promise<void> {
  return openDialog({
    title: "Couldn't import that file",
    body: reason,
    confirmLabel: 'Close',
    cancelLabel: null,
  }).then(() => undefined)
}

/** Returns the chosen name, or null when the dialog is cancelled. */
export function showSaveAsDialog(initialName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'app-dialog'

    const title = document.createElement('h2')
    title.className = 'dialog-title'
    title.textContent = 'Save board as'

    const field = document.createElement('label')
    field.className = 'dialog-field'
    const fieldLabel = document.createElement('span')
    fieldLabel.textContent = 'File name'
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'dialog-input'
    input.value = initialName
    field.append(fieldLabel, input)

    const hint = document.createElement('p')
    hint.className = 'dialog-hint'
    hint.textContent = 'The file is saved to your downloads folder.'

    const actions = document.createElement('div')
    actions.className = 'dialog-actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'dialog-btn'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => dialog.close('cancel'))
    const save = document.createElement('button')
    save.type = 'button'
    save.className = 'dialog-btn primary'
    save.textContent = 'Save'
    save.addEventListener('click', () => dialog.close('confirm'))
    actions.append(cancel, save)

    const submit = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        dialog.close('confirm')
      }
    }
    input.addEventListener('keydown', submit)

    dialog.append(title, field, hint, actions)
    document.body.appendChild(dialog)
    dialog.addEventListener('close', () => {
      const value = dialog.returnValue === 'confirm' ? input.value : null
      dialog.remove()
      resolve(value)
    })
    dialog.showModal()
    input.focus()
    input.select()
  })
}
