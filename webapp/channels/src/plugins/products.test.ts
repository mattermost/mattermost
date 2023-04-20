// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import testConfigureStore from 'tests/test_store';

import {initializeProducts} from './products';

(window as any).REMOTE_CONTAINERS = {};

describe('initializeProducts', () => {
    test('should set Client4 to use the correct Boards URL for product mode', async () => {
        const store = testConfigureStore({
            entities: {
                general: {
                    config: {
                        FeatureFlagBoardsProduct: 'true',
                    },
                },
            },
        });

        await store.dispatch(initializeProducts());

        expect(Client4.getBoardsRoute().startsWith('/plugins/boards')).toBe(true);
    });

    test('should set Client4 to use the correct Boards URL for plugin mode', async () => {
        const store = testConfigureStore({
            entities: {
                general: {
                    config: {
                        FeatureFlagBoardsProduct: 'false',
                    },
                },
            },
        });

        await store.dispatch(initializeProducts());

        expect(Client4.getBoardsRoute().startsWith('/plugins/focalboard')).toBe(true);
    });
});
