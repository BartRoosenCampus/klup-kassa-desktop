"use strict";

const CACHE_NAME = 'kassa-pwa-v1';
const urlsToCache = [
    './index.html',
    './css/style.css',
    './js/script.js',
    './json/producten.json',
    './img/logo.png'
];

// Installatie: sla bestanden op in de cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Ophalen van gecachete bestanden wanneer offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retourneer cache als deze beschikbaar is, anders haal op via netwerk
                return response || fetch(event.request);
            })
    );
});

// Activering: oude caches opruimen indien nodig
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});