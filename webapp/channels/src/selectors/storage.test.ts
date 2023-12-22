// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Selectors from 'selectors/storage';

import {getPrefix} from 'utils/storage_utils';

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

    it('getPrefix', () => {
        expect(getPrefix({} as GlobalState)).toEqual('unknown_');
        expect(getPrefix({entities: {}} as GlobalState)).toEqual('unknown_');
        expect(getPrefix({entities: {users: {currentUserId: 'not-exists'}}} as GlobalState)).toEqual('unknown_');
        expect(getPrefix({entities: {users: {currentUserId: 'not-exists', profiles: {}}}} as GlobalState)).toEqual('unknown_');
        expect(getPrefix({entities: {users: {currentUserId: 'exists', profiles: {exists: {id: 'user_id'}}}}} as unknown as GlobalState)).toEqual('user_id_');
    });

    it('makeGetGlobalItem', () => {
        expect(Selectors.makeGetGlobalItem('not-existing-global-item', undefined)(testState)).toEqual(undefined);
        expect(Selectors.makeGetGlobalItem('not-existing-global-item', 'default')(testState)).toEqual('default');
        expect(Selectors.makeGetGlobalItem('global-item', undefined)(testState)).toEqual('global-item-value');
    });

    it('makeGetItem', () => {
        expect(Selectors.makeGetItem('not-existing-item', undefined)(testState)).toEqual(undefined);
        expect(Selectors.makeGetItem('not-existing-item', 'default')(testState)).toEqual('default');
        expect(Selectors.makeGetItem('item', undefined)(testState)).toEqual('item-value');
    });
});
