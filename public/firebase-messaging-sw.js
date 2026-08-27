// Firebase Cloud Messaging Service Worker for AKGEC Times / College Times
// Handles background push notifications & deep-link tab focusing

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForServiceWorkerInitialization",
  projectId: "college-times-9f395",
  messagingSenderId: "100000000000",
  appId: "1:100000000000:web:dummyAppId",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background Push Notification Listener
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || '🚨 Campus Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New important campus update.',
    icon: '/pwa-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      postId: payload.data?.postId,
      channelId: payload.data?.channelId,
      priority: payload.data?.priority || 'normal',
      clickUrl: payload.data?.postId ? `/feed?postId=${payload.data.postId}` : '/',
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification Click Listener (Focuses existing tab or opens new client window)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickData = event.notification.data || {};
  const relativeUrl = clickData.clickUrl || (clickData.postId ? `/feed?postId=${clickData.postId}` : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if existing tab is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(relativeUrl);
          return client.focus();
        }
      }

      // If no matching window open, open new window
      if (clients.openWindow) {
        return clients.openWindow(relativeUrl);
      }
    })
  );
});
