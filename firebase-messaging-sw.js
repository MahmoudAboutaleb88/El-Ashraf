// ==============================================
// FIREBASE MESSAGING SERVICE WORKER
// ==============================================

// Import Firebase SDKs
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// Firebase configuration with your Sender ID
const firebaseConfig = {
    apiKey: "AIzaSyAATHo2-310ZNkYpaT_zMFEcYVfmzkZUR4",
    authDomain: "davinci-434f1.firebaseapp.com",
    databaseURL: "https://davinci-434f1-default-rtdb.firebaseio.com",
    projectId: "davinci-434f1",
    storageBucket: "davinci-434f1.firebasestorage.app",
    messagingSenderId: "1015604735230", // استخدم Sender ID الخاص بك
    appId: "1:1015604735230:web:default_app_id"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// ==============================================
// BACKGROUND MESSAGE HANDLER
// ==============================================
messaging.onBackgroundMessage((payload) => {
    console.log('📱 [Service Worker] Received background message:', payload);
    
    // Customize notification
    const notificationTitle = payload.notification?.title || 
                             payload.data?.title || 
                             'قبيلة الأشراف';
    
    const notificationBody = payload.notification?.body || 
                            payload.data?.body || 
                            'إشعار جديد';
    
    // استخدم أيقونة افتراضية (لن تحتاج لملف محلي)
    const notificationIcon = payload.notification?.icon || 
                            payload.data?.icon || 
                            'https://cdn-icons-png.flaticon.com/512/1077/1077114.png';
    
    const notificationData = payload.data || {};
    
    // Show notification
    self.registration.showNotification(notificationTitle, {
        body: notificationBody,
        icon: notificationIcon,
        badge: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
        image: payload.notification?.image || payload.data?.image,
        data: notificationData,
        tag: 'ashraf-push-notification',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: false, // لا يبقى مفتوحاً
        actions: [
            {
                action: 'open',
                title: 'فتح التطبيق'
            },
            {
                action: 'dismiss',
                title: 'تجاهل'
            }
        ]
    });
});

// ==============================================
// NOTIFICATION CLICK HANDLER
// ==============================================
self.addEventListener('notificationclick', (event) => {
    console.log('📱 [Service Worker] Notification clicked:', event.notification.tag);
    
    // Close the notification
    event.notification.close();
    
    const urlToOpen = '/'; // الصفحة الرئيسية (index.html)
    
    // Extract data from notification
    const notificationData = event.notification.data || {};
    
    // Handle different actions
    if (event.action === 'open') {
        // User clicked "open" action button
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })
            .then((windowClients) => {
                // Check if there is already a window/tab open
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    
                    // If we find our app
                    if (client.url.includes(window.location.origin)) {
                        // Focus on that window/tab
                        if ('focus' in client) {
                            client.focus();
                            
                            // If there's a postId, send a message to the page
                            if (notificationData.postId) {
                                client.postMessage({
                                    type: 'SCROLL_TO_POST',
                                    postId: notificationData.postId
                                });
                            }
                            
                            return;
                        }
                    }
                }
                
                // If no window/tab is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // User clicked "dismiss" action button
        console.log('Notification dismissed');
    } else {
        // User clicked the notification body (not an action button)
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })
            .then((windowClients) => {
                // Check for existing windows
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.includes(window.location.origin)) {
                        // Focus existing window
                        if ('focus' in client) {
                            client.focus();
                            
                            // Send message to scroll to post if needed
                            if (notificationData.postId) {
                                client.postMessage({
                                    type: 'SCROLL_TO_POST',
                                    postId: notificationData.postId
                                });
                            }
                            
                            return;
                        }
                    }
                }
                
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// ==============================================
// MESSAGE HANDLER (من الصفحة الرئيسية)
// ==============================================
self.addEventListener('message', (event) => {
    console.log('📱 [Service Worker] Message received from client:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_FCM_TOKEN') {
        // يمكنك الرد ببيانات الـ FCM إذا احتجت
        event.ports[0].postMessage({
            type: 'FCM_TOKEN_RESPONSE',
            message: 'Service Worker is ready'
        });
    }
});

// ==============================================
// INSTALL HANDLER
// ==============================================
self.addEventListener('install', (event) => {
    console.log('📱 [Service Worker] Installing...');
    
    // تجاوز مرحلة الانتظار لتثبيت Service Worker فوراً
    self.skipWaiting();
    
    // يمكنك تخزين الملفات المهمة في Cache إذا احتجت
    event.waitUntil(
        caches.open('ashraf-app-v1').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',
                '/app.js'
            ]).catch(error => {
                console.log('Cache addAll failed:', error);
            });
        })
    );
});

// ==============================================
// ACTIVATE HANDLER
// ==============================================
self.addEventListener('activate', (event) => {
    console.log('📱 [Service Worker] Activating...');
    
    // تحكم في كل الـ clients فوراً
    event.waitUntil(
        clients.claim().then(() => {
            console.log('✅ Service Worker now controls all clients');
            
            // إرسال رسالة لجميع الصفحات أن الـ Service Worker جاهز
            return self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SERVICE_WORKER_READY',
                        message: 'Service Worker is ready to handle push notifications'
                    });
                });
            });
        })
    );
});

// ==============================================
// FETCH HANDLER (اختياري - لتحسين الأداء)
// ==============================================
self.addEventListener('fetch', (event) => {
    // يمكنك التخزين المؤقت لتحسين الأداء
    if (event.request.url.includes('/style.css') || 
        event.request.url.includes('/app.js') ||
        event.request.url.includes('/index.html')) {
        
        event.respondWith(
            caches.match(event.request)
            .then((response) => {
                // إرجاع النسخة المخزنة أو جلب جديدة
                return response || fetch(event.request).then((fetchResponse) => {
                    // تخزين الاستجابة في الكاش
                    return caches.open('ashraf-app-v1').then((cache) => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            })
        );
    }
    // للطلبات الأخرى، استمر بدون تخزين
});

// ==============================================
// CONSOLE LOG FOR DEBUGGING
// ==============================================
console.log('✅ Firebase Messaging Service Worker loaded successfully');
console.log('✅ Service Worker scope:', self.registration?.scope);
console.log('✅ Firebase initialized:', firebase.app().name);
console.log('✅ Current origin:', self.location.origin);