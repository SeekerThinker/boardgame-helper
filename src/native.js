const TIMER_NOTIFICATION_ID = 41001;
let webNotificationTimer = null;
let appStateCleanup = null;
let wakeLockSentinel = null;
let wakeLockDesired = false;
let wakeLockVisibilityCleanup = null;

function capacitorPlugin(name) {
  return globalThis.Capacitor?.Plugins?.[name] || null;
}

function normalizePermission(value) {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  return 'prompt';
}

export function isNativePlatform() {
  return Boolean(globalThis.Capacitor?.isNativePlatform?.() || globalThis.Capacitor?.getPlatform?.() === 'ios' || globalThis.Capacitor?.getPlatform?.() === 'android');
}

export async function checkNotificationPermission() {
  const plugin = capacitorPlugin('LocalNotifications');
  if (plugin?.checkPermissions) {
    try {
      const result = await plugin.checkPermissions();
      return normalizePermission(result.display);
    } catch (_) {
      return 'prompt';
    }
  }
  if ('Notification' in globalThis) return normalizePermission(globalThis.Notification.permission);
  return 'denied';
}

export async function requestNotificationPermission() {
  const plugin = capacitorPlugin('LocalNotifications');
  if (plugin?.requestPermissions) {
    try {
      const result = await plugin.requestPermissions();
      return normalizePermission(result.display);
    } catch (_) {
      return 'denied';
    }
  }
  if ('Notification' in globalThis && globalThis.Notification.permission !== 'denied') {
    try { return normalizePermission(await globalThis.Notification.requestPermission()); } catch (_) { return 'denied'; }
  }
  return 'denied';
}

export async function scheduleTimerNotification({ deadlineMs, title, body, locale }) {
  await cancelTimerNotification();
  if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) return false;
  const plugin = capacitorPlugin('LocalNotifications');
  if (plugin?.schedule) {
    try {
      await plugin.schedule({
        notifications: [{
          id: TIMER_NOTIFICATION_ID,
          title,
          body,
          schedule: { at: new Date(deadlineMs), allowWhileIdle: true },
          channelId: 'board-game-timer',
          autoCancel: true,
          extra: { kind: 'timer', locale }
        }]
      });
      return true;
    } catch (_) {
      return false;
    }
  }
  if ('Notification' in globalThis && globalThis.Notification.permission === 'granted') {
    webNotificationTimer = globalThis.setTimeout(() => {
      try { new globalThis.Notification(title, { body, tag: 'board-game-timer', renotify: true }); } catch (_) {}
    }, Math.max(0, deadlineMs - Date.now()));
    return true;
  }
  return false;
}

export async function cancelTimerNotification() {
  if (webNotificationTimer) globalThis.clearTimeout(webNotificationTimer);
  webNotificationTimer = null;
  const plugin = capacitorPlugin('LocalNotifications');
  if (!plugin?.cancel) return;
  try { await plugin.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] }); } catch (_) {}
}

export async function initializeNotifications(locale = 'zh') {
  const plugin = capacitorPlugin('LocalNotifications');
  if (!plugin?.createChannel) return;
  try {
    await plugin.createChannel({
      id: 'board-game-timer',
      name: locale === 'zh' ? '桌游到时提醒' : 'Board Game Timer',
      description: locale === 'zh' ? '正在运行的桌游计时到零时提醒' : 'Alerts when an active board game timer reaches zero',
      importance: 5,
      visibility: 1,
      vibration: true
    });
  } catch (_) {}
}

export function observeAppState(callback) {
  appStateCleanup?.();
  const plugin = capacitorPlugin('App');
  if (plugin?.addListener) {
    let handle = null;
    plugin.addListener('appStateChange', state => callback(Boolean(state.isActive))).then(result => { handle = result; }).catch(() => {});
    appStateCleanup = () => handle?.remove?.();
    return appStateCleanup;
  }
  const listener = () => callback(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', listener);
  globalThis.addEventListener('pageshow', listener);
  appStateCleanup = () => {
    document.removeEventListener('visibilitychange', listener);
    globalThis.removeEventListener('pageshow', listener);
  };
  return appStateCleanup;
}

export async function copyText(text) {
  const clipboard = capacitorPlugin('Clipboard');
  if (clipboard?.write) {
    try { await clipboard.write({ string: text }); return true; } catch (_) {}
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (_) {}
  area.remove();
  return copied;
}

// Opens the OS share sheet where available (Android/iOS). Returns
// 'shared' | 'cancelled' | 'unsupported' so callers can fall back to copying.
export async function shareText(text) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: '', text });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      return 'unsupported';
    }
  }
  return 'unsupported';
}

function wakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function acquireWakeLock() {
  if (!wakeLockSupported()) return false;
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener?.('release', () => { wakeLockSentinel = null; });
    return true;
  } catch (_) {
    wakeLockSentinel = null;
    return false;
  }
}

// Requests a screen wake lock while `desired` is true (e.g. a running timer).
// Browsers release the lock automatically when the page hides; the listener
// re-acquires it once the page becomes visible again.
export async function setKeepScreenOn(desired) {
  wakeLockDesired = Boolean(desired);
  if (!wakeLockSupported()) return false;
  if (!wakeLockDesired) {
    try { await wakeLockSentinel?.release(); } catch (_) {}
    wakeLockSentinel = null;
    wakeLockVisibilityCleanup?.();
    wakeLockVisibilityCleanup = null;
    return false;
  }
  if (!wakeLockVisibilityCleanup && typeof document !== 'undefined') {
    const listener = () => {
      if (document.visibilityState === 'hidden') {
        wakeLockSentinel = null;
      } else if (wakeLockDesired && !wakeLockSentinel) {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', listener);
    wakeLockVisibilityCleanup = () => document.removeEventListener('visibilitychange', listener);
  }
  if (!wakeLockSentinel && document.visibilityState === 'visible') await acquireWakeLock();
  return Boolean(wakeLockSentinel);
}
