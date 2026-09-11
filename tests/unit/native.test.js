import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNotificationPermission, requestNotificationPermission } from '../../src/native.js';

function replaceGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
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
