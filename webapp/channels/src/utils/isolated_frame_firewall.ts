// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IsolatedFrameMessageHandler} from '@mattermost/shared/types/global';

// Any frame on the page, however sandboxed, can post a message to this window,
// and every `message` listener on the window receives it. Most listeners check
// the sender, but one that does not (in the web app, a plugin, or a library
// either of them loads) would let untrusted framed content drive the page.
//
// This firewall closes that path for frames registered as isolated: messages
// from such a frame, or from any frame nested inside it, go to the frame's own
// handler and to no other listener. It must be the first `message` listener on
// the window, because Chromium invokes a window's listeners in registration
// order whether or not they capture; it is installed by the first import of
// root.tsx, before any other module runs.

type Registration = {
    frame: HTMLIFrameElement;
    handler: IsolatedFrameMessageHandler;
};

type FirewallState = {
    registrations: Set<Registration>;
    listener: (event: MessageEvent) => void;
};

// The build can hold more than one copy of this module (the federated app entry
// gets its own), so the firewall's state lives on the window rather than in
// module scope: every copy then shares one registry and one listener.
const STATE_KEY = Symbol.for('mattermost.isolatedFrameFirewall');

function stateOf(win: Window): FirewallState | undefined {
    return (win as unknown as Record<symbol, FirewallState | undefined>)[STATE_KEY];
}

// Returns the registration whose frame is source or an ancestor of source,
// nearest first. Each step reads `parent`, which is readable cross-origin.
function findRegistration(win: Window, registrations: Set<Registration>, source: MessageEventSource | null): Registration | undefined {
    let current = source as Window | null;
    while (current && current !== win) {
        for (const registration of registrations) {
            if (registration.frame.contentWindow === current) {
                return registration;
            }
        }

        let parent: Window | null;
        try {
            parent = current.parent;
        } catch {
            return undefined;
        }
        if (!parent || parent === current) {
            return undefined;
        }
        current = parent;
    }
    return undefined;
}

// A message posted just before its frame was removed is delivered after the
// removal, when its source no longer leads back to any registered frame
// (Chromium reports the source as closed with no parent, Firefox reports no
// source at all).
function isDiscarded(source: MessageEventSource | null): boolean {
    if (!source) {
        return true;
    }
    try {
        return (source as Window).closed === true;
    } catch {
        return true;
    }
}

function handleMessage(win: Window, registrations: Set<Registration>, event: MessageEvent) {
    const registration = findRegistration(win, registrations, event.source);
    if (registration) {
        event.stopImmediatePropagation();
        registration.handler(event);
        return;
    }

    // Only sandboxed documents send the opaque origin 'null'. Once its frame is
    // gone, such a message cannot be attributed to a registered frame, so it is
    // dropped rather than handed to listeners that may not check the sender.
    if (event.origin === 'null' && isDiscarded(event.source)) {
        event.stopImmediatePropagation();
    }
}

export function installIsolatedFrameFirewall(win: Window = window): FirewallState {
    const existing = stateOf(win);
    if (existing) {
        return existing;
    }
    const registrations = new Set<Registration>();
    const state: FirewallState = {
        registrations,
        listener: (event: MessageEvent) => handleMessage(win, registrations, event),
    };
    Object.defineProperty(win, STATE_KEY, {value: state, configurable: true});
    win.addEventListener('message', state.listener, true);
    return state;
}

export function registerIsolatedFrame(frame: HTMLIFrameElement, handler: IsolatedFrameMessageHandler): () => void {
    // Not instanceof: an iframe created in another frame's document belongs to that
    // frame's realm.
    if (Object.prototype.toString.call(frame) !== '[object HTMLIFrameElement]') {
        throw new TypeError('registerIsolatedFrame requires an iframe element');
    }
    if (typeof handler !== 'function') {
        throw new TypeError('registerIsolatedFrame requires a message handler');
    }

    // Normally installed long before any plugin runs; installing here keeps a
    // registration from silently doing nothing if it ever was not.
    const {registrations} = installIsolatedFrameFirewall();

    const registration: Registration = {frame, handler};
    registrations.add(registration);
    return () => {
        registrations.delete(registration);
    };
}

// Test-only reset.
export function resetIsolatedFrameFirewall(win: Window = window) {
    const state = stateOf(win);
    if (state) {
        win.removeEventListener('message', state.listener, true);
        delete (win as unknown as Record<symbol, unknown>)[STATE_KEY];
    }
}
