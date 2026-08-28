/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBKcYLCcg2STjyr5oGX3EoUTZA-NeavfwM',
  authDomain: 'defencegardenbooking.firebaseapp.com',
  projectId: 'defencegardenbooking',
  storageBucket: 'defencegardenbooking.firebasestorage.app',
  messagingSenderId: '860382390967',
  appId: '1:860382390967:web:8c1625a43fa58f95c2fb32',
});

// Initializing Messaging registers Firebase's background push and notification
// click handlers. Notification payloads are displayed even when the app is closed.
firebase.messaging();
