// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {installIsolatedFrameFirewall, resetIsolatedFrameFirewall} from 'utils/isolated_frame_firewall';

import {publishedIsolatedFrameUtils} from './published_isolated_frames';

describe('publishedIsolatedFrameUtils.register', () => {
    afterEach(() => {
        resetIsolatedFrameFirewall();
        document.body.innerHTML = '';
    });

    test('hides messages from a registered frame from other window listeners', () => {
        installIsolatedFrameFirewall();
        const otherListener = jest.fn();
        window.addEventListener('message', otherListener);
        const frame = document.createElement('iframe');
        document.body.appendChild(frame);
        const handler = jest.fn();

        const unregister = publishedIsolatedFrameUtils.register(frame, handler);
        window.dispatchEvent(new MessageEvent('message', {data: 'x', origin: 'null', source: frame.contentWindow}));
        unregister();
        window.removeEventListener('message', otherListener);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(otherListener).not.toHaveBeenCalled();
    });
});
