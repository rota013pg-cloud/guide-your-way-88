/**
 * Helpers para Web Notifications (desktop pop-up) com de-duplicação por id.
 * Seguro para SSR.
 */
const _shownIds = new Set<string>();

export function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}

export function showDesktopNotification(opts: {
  id: string | number;
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const key = String(opts.id);
  if (_shownIds.has(key)) return;
  _shownIds.add(key);
  if (_shownIds.size > 200) {
    // limpa cache antigo
    const arr = Array.from(_shownIds);
    arr.slice(0, 100).forEach((k) => _shownIds.delete(k));
  }
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag ?? `rota013-${key}`,
      icon: "/icon-192.png",
    });
    if (opts.onClick) {
      n.onclick = () => {
        try { window.focus(); } catch { /* ignore */ }
        opts.onClick?.();
        n.close();
      };
    }
  } catch {
    /* ignore */
  }
}
