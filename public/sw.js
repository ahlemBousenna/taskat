const CACHE_NAME = 'digitask-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/digitask-icon-192.png',
  '/digitask-icon-512.png',
  '/digitask-badge-96.png'
];

// حدث التثبيت: كاش الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn('تنبيه: فشل كاش الملف الأساسي ' + asset + ': ', err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// حدث التنشيط: حذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// حدث جلب البيانات (Fetch) مع استراتيجية استجابة متقدمة للعمل دون اتصال
self.addEventListener('fetch', (event) => {
  // نقبل فقط طلبات GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 1. تجاوز الطلبات الخارجية (مثل Supabase أو أي نطاق خارجي)
  if (url.hostname !== self.location.hostname) {
    return;
  }

  // 2. تجاوز ملفات التطوير الخاصة بالـ Hot Module Replacement (HMR) والـ API
  if (
    url.pathname.includes('webpack-hmr') ||
    url.pathname.startsWith('/api')
  ) {
    return;
  }

  // 3. معالجة طلبات التنقل (Navigate) لصفحات الموقع (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // حفظ الصفحة المجلوبة حديثاً في الكاش لتحديث المحتوى
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // إذا كان المستخدم أوفلاين، نقوم بتقديم صفحة الجذر المخبأة كبديل افتراضي
          return caches.match('/').then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response('أنت غير متصل بالإنترنت حالياً والصفحة المطلوبة غير مخبأة.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
            });
          });
        })
    );
    return;
  }

  // 4. استراتيجية Stale-While-Revalidate لملفات Next.js الاستاتيكية والأصول الأخرى لتسريع التصفح وضمان الأوفلاين
  const isStaticAsset = url.pathname.startsWith('/_next/static') || 
                        url.pathname.endsWith('.js') || 
                        url.pathname.endsWith('.css') || 
                        url.pathname.endsWith('.png') || 
                        url.pathname.endsWith('.jpg') || 
                        url.pathname.endsWith('.svg') || 
                        url.pathname.endsWith('.ico') || 
                        url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // تجاهل أخطاء الشبكة الصامتة أثناء التحديث في الخلفية
        });

        // إرجاع الملف المخبأ فوراً إذا وجد، وإلا ننتظر الشبكة
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. الاستراتيجية الافتراضية لباقي طلبات الموقع: Network-First
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response('أنت غير متصل بالإنترنت حالياً.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
      })
  );
});

// الاستماع لإشعارات الويب اللحظية (Push API)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'لديك إشعار جديد في ديجي تاسك.',
      icon: self.location.origin + '/digitask-icon-192.png',
      badge: self.location.origin + '/digitask-badge-96.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/standup'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'ديجي تاسك', options)
    );
  } catch (err) {
    console.error('فشل في معالجة إشعار Push:', err);
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('ديجي تاسك', {
        body: text,
        icon: self.location.origin + '/digitask-icon-192.png',
        badge: self.location.origin + '/digitask-badge-96.png'
      })
    );
  }
});

// فتح التطبيق أو الانتقال للرابط عند النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/standup';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            if (client.url !== self.location.origin + urlToOpen && 'navigate' in client) {
              return client.navigate(urlToOpen);
            }
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
