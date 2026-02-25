// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Techzen Web Push — React hook for subscribing to browser push notifications.

import { useCallback, useEffect, useRef, useState } from 'react';

import { Client4 } from 'mattermost-redux/client';

type WebPushStatus = 'idle' | 'subscribing' | 'subscribed' | 'denied' | 'unsupported' | 'error';

const STORAGE_KEY = 'techzen-web-push-subscribed';

// urlBase64ToUint8Array converts a base64 VAPID public key to Uint8Array
// (required by pushManager.subscribe)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export type UseWebPushReturn = {
    status: WebPushStatus;
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
}

/**
 * useWebPush — manages VAPID web push subscription lifecycle.
 * Requires:
 *  1. Service Worker registered (handled in root.tsx)
 *  2. HTTPS environment
 *  3. MM_PUSH_WEB_VAPID_PUBLIC_KEY configured on server
 */
export function useWebPush(): UseWebPushReturn {
    const [status, setStatus] = useState<WebPushStatus>(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return 'unsupported';
        }
        if (Notification.permission === 'denied') {
            return 'denied';
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'true' ? 'subscribed' : 'idle';
    });

    const subscriptionRef = useRef<PushSubscription | null>(null);

    const getVAPIDPublicKey = useCallback(async (): Promise<string | null> => {
        try {
            const resp = await fetch('/api/v4/push/web/vapid-key', {
                headers: { Authorization: `Bearer ${Client4.getToken()}` },
            });
            if (!resp.ok) {
                return null;
            }
            const data = await resp.json();
            return data.public_key || null;
        } catch {
            return null;
        }
    }, []);

    const subscribe = useCallback(async () => {
        if (status === 'unsupported' || status === 'subscribing') {
            return;
        }
        setStatus('subscribing');

        try {
            const vapidKey = await getVAPIDPublicKey();
            if (!vapidKey) {
                setStatus('error');
                return;
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setStatus('denied');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const keyArray = urlBase64ToUint8Array(vapidKey);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: keyArray.buffer as ArrayBuffer,
            });

            subscriptionRef.current = subscription;
            const subJson = subscription.toJSON();

            // Send subscription to Mattermost server
            const resp = await fetch('/api/v4/push/web/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Client4.getToken()}`,
                },
                body: JSON.stringify({
                    endpoint: subJson.endpoint,
                    keys: {
                        auth: subJson.keys?.auth ?? '',
                        p256dh: subJson.keys?.p256dh ?? '',
                    },
                }),
            });

            if (resp.ok) {
                localStorage.setItem(STORAGE_KEY, 'true');
                setStatus('subscribed');
            } else {
                setStatus('error');
            }
        } catch (err) {
            // User closed the permission dialog or error
            setStatus('error');
        }
    }, [status, getVAPIDPublicKey]);

    const unsubscribe = useCallback(async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            if (existing) {
                const endpoint = existing.endpoint;
                await existing.unsubscribe();

                await fetch('/api/v4/push/web/subscribe', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${Client4.getToken()}`,
                    },
                    body: JSON.stringify({ endpoint }),
                });
            }
            localStorage.removeItem(STORAGE_KEY);
            setStatus('idle');
        } catch {
            setStatus('error');
        }
    }, []);

    // On mount: verify existing subscription is still valid
    useEffect(() => {
        if (status !== 'subscribed') {
            return;
        }
        (async () => {
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            if (!existing) {
                localStorage.removeItem(STORAGE_KEY);
                setStatus('idle');
            }
        })();
    }, []); // eslint-disable-line

    return { status, subscribe, unsubscribe };
}
