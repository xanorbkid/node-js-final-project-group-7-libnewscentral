const CACHE_NAME = 'news-platform-cache-v1';
const urlsToCache = [
  // Main Pages
  '/',
  '/categories',
  '/articles',
  '/admin/dashboard',
  '/offline.html',
  
  // Stylesheets
  '../assets/css/unicons.min.css',
  '../assets/css/prettify.min.css',
  '../assets/css/swiper-bundle.min.css',
  '../assets/css/theme/demo-two.min.css',
  
  // Scripts
  '../assets/js/libs/jquery.min.js',
  '../assets/js/libs/scrollmagic.min.js',
  '../assets/js/libs/swiper-bundle.min.js',
  '../assets/js/libs/anime.min.js',
  '../assets/js/helpers/data-attr-helper.js',
  '../assets/js/helpers/swiper-helper.js',
  '../assets/js/helpers/anime-helper.js',
  '../assets/js/helpers/anime-helper-defined-timelines.js',
  '../assets/js/uikit-components-bs.js',
  '../assets/js/app.js',
  '../assets/js/app-head-bs.js',
  
  // Fonts & Icons
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  
  // Images
  '../assets/images/demo-two/common/libnews-light.svg',
  '../../../unistudio.co/html/news5/assets/images/common/seo-image.html',
  '../../../unistudio.co/html/LibNews Central/assets/images/common/seo-image.html',
  '/icons/libnews-192x192.png',
  '/icons/libnews-512x512.png',
  
  // Uni-core components
  '../assets/js/uni-core/css/uni-core.min.css',
  '../assets/js/uni-core/js/uni-core-bundle.min.js'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch and cache new requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
