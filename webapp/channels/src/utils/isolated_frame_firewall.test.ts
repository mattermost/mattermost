// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {installIsolatedFrameFirewall, registerIsolatedFrame, resetIsolatedFrameFirewall} from './isolated_frame_firewall';

function addFrame(parent: Document = document): HTMLIFrameElement {
    const frame = parent.createElement('iframe');
    parent.body.appendChild(frame);
    return frame;
}

function post(source: MessageEventSource | null, origin: string, data: unknown = 'payload') {
    window.dispatchEvent(new MessageEvent('message', {data, origin, source}));
}

describe('isolated frame firewall', () => {
    let otherListener: jest.Mock;

    beforeEach(() => {
        // As in production, the firewall is the first listener on the window.
        installIsolatedFrameFirewall();
        otherListener = jest.fn();
        window.addEventListener('message', otherListener);
        window.addEventListener('message', otherListener, true);
        window.onmessage = otherListener;
    });

    afterEach(() => {
        window.removeEventListener('message', otherListener);
        window.removeEventListener('message', otherListener, true);
        window.onmessage = null;
        resetIsolatedFrameFirewall();
        document.body.innerHTML = '';
    });

    test.each([
        ['the registered frame', (frame: HTMLIFrameElement) => frame.contentWindow],
        ['a frame nested inside the registered frame', (frame: HTMLIFrameElement) => addFrame(frame.contentDocument!).contentWindow],
        ['a frame nested two levels inside the registered frame', (frame: HTMLIFrameElement) => addFrame(addFrame(frame.contentDocument!).contentDocument!).contentWindow],
    ])('delivers a message from %s only to the registered handler', (_, sourceOf) => {
        const frame = addFrame();
        const handler = jest.fn();
        registerIsolatedFrame(frame, handler);

        post(sourceOf(frame), 'null', {evil: true});

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].data).toEqual({evil: true});
        expect(otherListener).not.toHaveBeenCalled();
    });

    test('routes a message to the nearest registered frame when registrations are nested', () => {
        const outer = addFrame();
        const inner = addFrame(outer.contentDocument!);
        const outerHandler = jest.fn();
        const innerHandler = jest.fn();
        registerIsolatedFrame(outer, outerHandler);
        registerIsolatedFrame(inner, innerHandler);

        post(inner.contentWindow, 'null');

        expect(innerHandler).toHaveBeenCalledTimes(1);
        expect(outerHandler).not.toHaveBeenCalled();
    });

    test.each([
        ['an unregistered frame', () => addFrame().contentWindow, 'null'],
        ['this window', () => window, window.location.origin],
    ])('leaves a message from %s to the other listeners', (_, sourceOf, origin) => {
        const handler = jest.fn();
        registerIsolatedFrame(addFrame(), handler);

        post(sourceOf(), origin);

        expect(handler).not.toHaveBeenCalled();
        expect(otherListener).toHaveBeenCalledTimes(3);
    });

    test('stops isolating a frame once its registration is removed', () => {
        const frame = addFrame();
        const handler = jest.fn();
        const unregister = registerIsolatedFrame(frame, handler);
        unregister();

        post(frame.contentWindow, 'null');

        expect(handler).not.toHaveBeenCalled();
        expect(otherListener).toHaveBeenCalledTimes(3);
    });

    test.each([
        ['no source', null],
        ['a closed source', {closed: true, parent: null} as unknown as Window],
    ])('drops a sandboxed message with %s, as sent just before its frame was removed', (_, source) => {
        post(source, 'null');

        expect(otherListener).not.toHaveBeenCalled();
    });

    test('leaves a message with no source and a real origin to the other listeners', () => {
        post(null, 'https://example.com');

        expect(otherListener).toHaveBeenCalledTimes(3);
    });

    test('a frame registered through a second copy of the module is isolated by the firewall installed first', () => {
        let copy: typeof import('./isolated_frame_firewall') | undefined;
        jest.isolateModules(() => {
            copy = require('./isolated_frame_firewall');
        });
        const frame = addFrame();
        const handler = jest.fn();
        copy!.registerIsolatedFrame(frame, handler);

        post(frame.contentWindow, 'null');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(otherListener).not.toHaveBeenCalled();
    });

    test('installs itself when a frame is registered before installation', () => {
        resetIsolatedFrameFirewall();
        const frame = addFrame();
        const handler = jest.fn();
        registerIsolatedFrame(frame, handler);

        post(frame.contentWindow, 'null');

        expect(handler).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['a non-iframe element', () => registerIsolatedFrame(document.createElement('div') as unknown as HTMLIFrameElement, jest.fn())],
        ['a missing handler', () => registerIsolatedFrame(addFrame(), undefined as unknown as () => void)],
    ])('rejects %s', (_, call) => {
        expect(call).toThrow(TypeError);
    });
});
