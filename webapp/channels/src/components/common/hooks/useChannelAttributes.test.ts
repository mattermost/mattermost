// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';

import type {PropertyField} from '@mattermost/types/properties';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useChannelAttributes from './useChannelAttributes';

type PartialState = Parameters<typeof renderHookWithContext>[1];

jest.mock('mattermost-redux/actions/properties', () => ({
    __esModule: true,
    fetchPropertyFields: jest.fn(),
}));

const mockedFetch = fetchPropertyFields as jest.MockedFunction<typeof fetchPropertyFields>;

const GROUP_ID = 'group_access_control';

const field: PropertyField = {
    id: 'f_program',
    group_id: GROUP_ID,
    name: 'program',
    type: 'select',
    target_id: '',
    target_type: 'system',
    object_type: CHANNEL_OBJECT_TYPE,
    create_at: 1,
    update_at: 1,
    delete_at: 0,
    created_by: '',
    updated_by: '',
};

// A store where the fields have landed but the group name -> id mapping has not.
// This is what a websocket field event alone produces, since only the fetch
// carries the group name.
function stateWith({groupResolved}: {groupResolved: boolean}): PartialState {
    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: 'true'},
                license: {IsLicensed: 'true', SkuShortName: 'advanced'},
            },
            properties: {
                groups: groupResolved ? {
                    byId: {[GROUP_ID]: {id: GROUP_ID, name: ACCESS_CONTROL_PROPERTY_GROUP}},
                    byName: {[ACCESS_CONTROL_PROPERTY_GROUP]: {id: GROUP_ID, name: ACCESS_CONTROL_PROPERTY_GROUP}},
                } : {byId: {}, byName: {}},
                fields: {
                    byId: {[field.id]: field},
                    byObjectType: {[CHANNEL_OBJECT_TYPE]: {[GROUP_ID]: {[field.id]: field}}},
                },
                values: {byTargetId: {}, byFieldId: {}},
            },
        },
    } as PartialState;
}

describe('useChannelAttributes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedFetch.mockReturnValue((() => Promise.resolve({data: [field]})) as ReturnType<typeof fetchPropertyFields>);
    });

    test('reports the fields once the group mapping has landed', async () => {
        const {result} = renderHookWithContext(() => useChannelAttributes(), stateWith({groupResolved: true}));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.enabled).toBe(true);
        expect(result.current.failed).toBe(false);
        expect(result.current.fields).toHaveLength(1);
    });

    test('settles rather than loading forever when the fetch rejects', async () => {
        mockedFetch.mockReturnValue((() => Promise.reject(new Error('network'))) as ReturnType<typeof fetchPropertyFields>);

        const {result} = renderHookWithContext(() => useChannelAttributes(), stateWith({groupResolved: false}));

        await waitFor(() => expect(result.current.failed).toBe(true));
        expect(result.current.loading).toBe(false);
    });

    test('treats an error result the same as a rejection', async () => {
        mockedFetch.mockReturnValue((() => Promise.resolve({error: new Error('boom')})) as ReturnType<typeof fetchPropertyFields>);

        const {result} = renderHookWithContext(() => useChannelAttributes(), stateWith({groupResolved: false}));

        await waitFor(() => expect(result.current.failed).toBe(true));
    });

    test('does not fetch or report anything without an enterprise licence', async () => {
        const state = stateWith({groupResolved: true}) as {entities: {general: {license: {SkuShortName: string}}}};
        state.entities.general.license.SkuShortName = 'professional';

        const {result} = renderHookWithContext(() => useChannelAttributes(), state as PartialState);

        expect(result.current.enabled).toBe(false);
        expect(result.current.fields).toEqual([]);
        expect(mockedFetch).not.toHaveBeenCalled();
    });
});
