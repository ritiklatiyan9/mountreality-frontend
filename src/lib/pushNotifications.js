import {
  getMessaging, getToken, isSupported, onMessage,
} from 'firebase/messaging';
import api from '../api/api';
import { firebaseApp } from './firebase';

const VAPID_KEY = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
let messagingPromise;
let registrationPromise;

const supportedMessaging = async () => {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(firebaseApp) : null))
      .catch(() => null);
  }
  return messagingPromise;
};

const serviceWorkerRegistration = async () => {
  if (!('serviceWorker' in navigator)) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => {
        registrationPromise = null;
        throw error;
      });
  }
  return registrationPromise;
};

const persistToken = async ({ requestPermission }) => {
  if (!('Notification' in globalThis)) return { status: 'unsupported' };
  let permission = globalThis.Notification.permission;
  if (permission === 'default' && requestPermission) {
    permission = await globalThis.Notification.requestPermission().catch(() => 'denied');
  }
  if (permission !== 'granted') return { status: permission };

  const messaging = await supportedMessaging();
  if (!messaging) return { status: 'unsupported' };
  const registration = await serviceWorkerRegistration();
  if (!registration) return { status: 'unsupported' };
  const options = { serviceWorkerRegistration: registration };
  if (VAPID_KEY) options.vapidKey = VAPID_KEY;
  const token = await getToken(messaging, options);
  if (!token) return { status: 'unavailable' };
  await api.post('/compliance/push-tokens', {
    token,
    user_agent: navigator.userAgent,
    device_label: navigator.platform || 'Web browser',
  });
  return { status: 'enabled', token };
};

/** Must be called from a click/submit gesture so browsers may show permission UI. */
export const enableWebPushNotifications = () => persistToken({ requestPermission: true });

/** Refresh an existing grant without prompting during normal authenticated app startup. */
export const refreshExistingWebPushToken = () => persistToken({ requestPermission: false });

export const subscribeToForegroundPush = async (handler) => {
  const messaging = await supportedMessaging();
  return messaging ? onMessage(messaging, handler) : () => {};
};
