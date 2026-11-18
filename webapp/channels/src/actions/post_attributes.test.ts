// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import mockStore from 'tests/test_store';

import {loadPostAttributeFields} from './post_attributes';

describe('actions/post_attributes', () => {
    const channelId = 'channel_id';

    function stateWithFlag(enabled: boolean) {
        return {
            entities: {
                general: {
                    config: {FeatureFlagPostAttributes: enabled ? 'true' : 'false'},
                },
                properties: {
                    fields: {byId: {}, byObjectType: {}},
                    values: {byTargetId: {}, byFieldId: {}},
                    groups: {byId: {}, byName: {}},
                },
            },
        };
    }

    let getPropertyFields: jest.SpyInstance;

    beforeEach(() => {
        getPropertyFields = jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('does nothing when the feature flag is off', async () => {
        const store = mockStore(stateWithFlag(false));

        const result = await store.dispatch(loadPostAttributeFields(channelId));

        expect(result).toEqual({data: false});
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    test('does nothing without a channel id', async () => {
        const store = mockStore(stateWithFlag(true));

        const result = await store.dispatch(loadPostAttributeFields(undefined));

        expect(result).toEqual({data: false});
        expect(getPropertyFields).not.toHaveBeenCalled();
    });

    test('fetches the channel scope hierarchically', async () => {
        const store = mockStore(stateWithFlag(true));

        const result = await store.dispatch(loadPostAttributeFields(channelId));

        expect(result).toEqual({data: true});
        expect(getPropertyFields).toHaveBeenCalledWith('post_attributes', 'post', {channelId});
    });
});
