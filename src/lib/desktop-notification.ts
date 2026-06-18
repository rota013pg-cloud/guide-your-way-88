/**
 * Helpers para Web Notifications (desktop pop-up) com de-duplicação por id.
 * Seguro para SSR.
 */
const _shownIds = new Set<string>();
let permissionUnlockBound = false;

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function requestPermissionFromGesture() {
  if (!canUseNotifications() || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

function bindPermissionUnlock() {
  if (!canUseNotifications() || permissionUnlockBound || Notification.permission !== "default") return;
  permissionUnlockBound = true;
  const handler = () => {
    void requestPermissionFromGesture();
    window.removeEventListener("touchend", handler);
    window.removeEventListener("touchstart", handler);
    window.removeEventListener("click", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("touchend", handler, { passive: true });
  window.addEventListener("touchstart", handler, { passive: true });
  window.addEventListener("click", handler);
  window.addEventListener("keydown", handler);
}

export function ensureNotificationPermission() {
  if (!canUseNotifications()) return;
  bindPermissionUnlock();
}

export function showDesktopNotification(opts: {
  id: string | number;
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}) {
  if (!canUseNotifications()) return;
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
