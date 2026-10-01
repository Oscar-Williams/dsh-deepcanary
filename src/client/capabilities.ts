/** Same-origin transport also works under Desktop's public protocol forwarder. */
export interface ClientCapabilities {
  request(path: string, init?: RequestInit): Promise<Response>
  notify(title: string, options: NotificationOptions): Notification
  focus(): void
}

export const rendererCapabilities: ClientCapabilities = {
  request: (path, init) => {
    const endpoint = path.split('?')[0]
    if (!['state', 'settings', 'health', 'action', 'explain', 'dry-run', 'outcomes', 'outcome', 'supervisor']
      .some(name => endpoint === '/api/dsh-deepcanary/' + name)) return Promise.reject(new Error('Invalid plugin endpoint'))
    return fetch(path, { cache: 'no-store', ...init })
  },
  notify: (title, options) => new Notification(title, options),
  focus: () => { window.focus() },
}
