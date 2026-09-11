import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkNotificationPermission, requestNotificationPermission, observeAppState
} from '../../src/native.js';

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

test('browser notification default is treated as a prompt state', async () => {
  const restoreCapacitor = replaceGlobal('Capacitor', undefined);
  const restoreNotification = replaceGlobal('Notification', {
    permission: 'default',
    requestPermission: async () => 'default'
  });
  try {
    assert.equal(await checkNotificationPermission(), 'prompt');
    assert.equal(await requestNotificationPermission(), 'prompt');
  } finally {
    restoreNotification();
    restoreCapacitor();
  }
});

test('native notification permission states are normalized', async () => {
  const restoreNotification = replaceGlobal('Notification', undefined);
  const restoreCapacitor = replaceGlobal('Capacitor', {
    Plugins: {
      LocalNotifications: {
        checkPermissions: async () => ({ display: 'prompt-with-rationale' }),
        requestPermissions: async () => ({ display: 'denied' })
      }
    }
  });
  try {
    assert.equal(await checkNotificationPermission(), 'prompt');
    assert.equal(await requestNotificationPermission(), 'denied');
  } finally {
    restoreCapacitor();
    restoreNotification();
  }
});

test('native app-state listener is removed even when registration resolves after cleanup', async () => {
  const pending = [];
  const removed = [0, 0];
  const restoreCapacitor = replaceGlobal('Capacitor', {
    Plugins: {
      App: {
        addListener() {
          return new Promise(resolve => pending.push(resolve));
        }
      }
    }
  });

  let cleanupSecond = null;
  try {
    observeAppState(() => {});
    cleanupSecond = observeAppState(() => {});
    assert.equal(pending.length, 2, 'rebinding starts a fresh native listener registration');

    pending[0]({ remove: () => { removed[0] += 1; } });
    await flushPromises();
    assert.equal(removed[0], 1, 'the stale async registration is cleaned up once it resolves');

    pending[1]({ remove: () => { removed[1] += 1; } });
    await flushPromises();
    assert.equal(removed[1], 0);
    cleanupSecond();
    assert.equal(removed[1], 1, 'the active listener is removed normally');
    cleanupSecond = null;
  } finally {
    cleanupSecond?.();
    restoreCapacitor();
  }
});
