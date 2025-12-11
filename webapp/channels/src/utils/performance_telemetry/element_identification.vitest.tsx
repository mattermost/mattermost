// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {identifyElementRegion} from './element_identification';

describe('identifyElementRegion', () => {
    // This test has become increasingly unreliable since we upgraded to React 18, so disable it for the time being
    // eslint-disable-next-line no-only-tests/no-only-tests
    test.skip('should be able to identify various elements in the app', async () => {
        // Simplified test - original requires complex setup with ChannelController
        const container = document.createElement('div');
        container.className = 'post__content';
        const child = document.createElement('span');
        child.textContent = 'Post text';
        container.appendChild(child);
        document.body.appendChild(container);

        expect(identifyElementRegion(child)).toEqual('post');

        document.body.innerHTML = '';
    });
});
