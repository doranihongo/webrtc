"use strict";

// Minimal service worker - exists only to satisfy PWA "installability"
// criteria (Chrome/Android requires a registered fetch handler before it
// will offer the app-like Install/"Add to Home Screen" experience).
//
// No caching whatsoever: every request just passes straight through to
// the network. This is a live WebRTC signaling app - anything that could
// serve stale HTML/JS from a cache would be actively harmful here.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
