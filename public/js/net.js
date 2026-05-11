export class Net {
  constructor(url, handlers = {}) {
    this.url = url;
    this.handlers = handlers;
    this.ws = null;
    this.backoff = 500;
    this.alive = true;
    this.opened = false;
  }

  connect() {
    if (!this.alive) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this._retry();
      return;
    }

    this.ws.addEventListener('open', () => {
      this.backoff = 500;
      this.opened = true;
      this.handlers.onOpen?.();
    });

    this.ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg || typeof msg.type !== 'string') return;
      switch (msg.type) {
        case 'state':
          this.handlers.onState?.(msg.payload);
          break;
        case 'event':
          this.handlers.onEvent?.(msg.payload);
          break;
        case 'error':
          this.handlers.onError?.(msg.payload);
          break;
        case 'ping':
          this.send({ type: 'pong' });
          break;
      }
    });

    this.ws.addEventListener('close', () => {
      const wasOpen = this.opened;
      this.opened = false;
      this.handlers.onClose?.(wasOpen);
      this._retry();
    });

    this.ws.addEventListener('error', () => {
      try { this.ws.close(); } catch {}
    });
  }

  _retry() {
    if (!this.alive) return;
    setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 5000);
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  close() {
    this.alive = false;
    try { this.ws?.close(); } catch {}
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
