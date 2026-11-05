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
