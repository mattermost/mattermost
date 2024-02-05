// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Selectors from 'selectors/storage';

import type {GlobalState} from 'types/store';

describe('Selectors.Storage', () => {
    const testState = {
        entities: {
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: {
                        id: 'user_id',
                    },
                },
            },
        },
        storage: {
            storage: {
                'global-item': {value: 'global-item-value', timestamp: new Date()},
                user_id_item: {value: 'item-value', timestamp: new Date()},
            },
        },
    } as unknown as GlobalState;

    it('makeGetGlobalItem', () => {
        expect(Selectors.makeGetGlobalItem('not-existing-global-item', undefined)(testState)).toEqual(undefined);
        expect(Selectors.makeGetGlobalItem('not-existing-global-item', 'default')(testState)).toEqual('default');
        expect(Selectors.makeGetGlobalItem('global-item', undefined)(testState)).toEqual('global-item-value');
    });
});
