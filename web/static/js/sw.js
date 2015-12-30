// Copyright (c) 2016 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

self.addEventListener('install', function(event) {
    self.skipWaiting();
});

function getRegistrationId(gcmEndpoint) {
    var segments = gcmEndpoint.trim().split('/');
    return segments[segments.length - 1];
}

self.addEventListener('push', function(event) {
    event.waitUntil(
            self.registration.pushManager.getSubscription().then(function(sub) {
                if (!sub) {
                    console.warn('Nothing subscribed');
                    return;
                }

                var url = "/api/v1/users/webpush_message/pop";
                var registrationId = getRegistrationId(sub.endpoint);
                var options = {
                    method: 'POST',
                    body: JSON.stringify({ registration_id:  registrationId }),
                    credentials: 'include'
                };

                fetch(url, options).then(function(response) {
                    if (response.ok) {
                        response.json().then(function(messages) {
                            for(var i = 0; i < messages.length; i++) {
                                var message = messages[i];
                                self.registration.showNotification(message.title, {
                                    body: message.message,
                                    icon: "/static/images/icon50x50.png",
                                    tag: message.url
                                });
                            }
                        });
                    } else {
                        console.warn("Failed to fetch a message: url=" + response.url + " status=" + response.status);
                    }
                });
            })
    );
});

self.addEventListener('notificationclick', function(event) {
    var url = event.notification.tag;
    event.notification.close();
    event.waitUntil(
            clients.matchAll({
                type: 'window'
            }).then(function(windowClients) {
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});
