// 最小 Service Worker:仅用于让浏览器将站点识别为可安装的 PWA。
// 这里有意不做任何缓存,避免发版后用户卡在旧资源。
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // 透传:不拦截,让浏览器走默认网络。
});
