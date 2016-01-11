// Copyright (c) 2016 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';

function subscribe(reg) {
    reg.pushManager.subscribe({
        userVisibleOnly: true
    }).then((sub) => {
        Client.registerWebpushEndpoint(sub.endpoint);
    });
}

export function registerForWebpush() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.register('/static/js/sw.js').then((reg) => {
        subscribe(reg);
    });
}

export function getRegistration() {
    return navigator.serviceWorker.getRegistration('/static/js/');
}
