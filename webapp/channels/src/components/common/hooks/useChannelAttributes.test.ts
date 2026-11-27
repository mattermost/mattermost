// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, waitFor} from '@testing-library/react';
import {useStore} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';

import {renderHookWithContext} from 'tests/react_testing_utils';

import useChannelAttributes from './useChannelAttributes';
import useMissingRequiredChannelAttributes from './useMissingRequiredChannelAttributes';

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

    test('reuses fields already in the store when asked to, and fetches otherwise', async () => {
        const {result} = renderHookWithContext(() => useChannelAttributes({reuseLoadedFields: true}), stateWith({groupResolved: true}));

        expect(result.current.loading).toBe(false);
        expect(result.current.fields).toHaveLength(1);
        expect(mockedFetch).not.toHaveBeenCalled();

        const empty = stateWith({groupResolved: true}) as {entities: {properties: {fields: {byId: object; byObjectType: object}}}};
        empty.entities.properties.fields = {byId: {}, byObjectType: {}};
        renderHookWithContext(() => useChannelAttributes({reuseLoadedFields: true}), empty as PartialState);

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    });

    test('mounts that start together share one fields request', async () => {
        const state = stateWith({groupResolved: true});
        renderHookWithContext(() => [useChannelAttributes(), useChannelAttributes(), useChannelAttributes()], state);

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    });

    test('refetches reused fields once after a websocket reconnect, shared across mounts', async () => {
        // A first, non-reusing mount records the connect time its fetch saw, then goes away.
        let withFetcher = true;
        const {result, rerender} = renderHookWithContext(
            () => {
                const store = useStore();
                const fetcher = useChannelAttributes({skip: !withFetcher});
                const a = useChannelAttributes({reuseLoadedFields: true});
                const b = useChannelAttributes({reuseLoadedFields: true});
                return {store, fetcher, a, b};
            },
            stateWith({groupResolved: true}),
        );
        await waitFor(() => expect(result.current.fetcher.loading).toBe(false));

        // The reusing mounts took the cache without asking.
        expect(mockedFetch).toHaveBeenCalledTimes(1);
        mockedFetch.mockClear();

        withFetcher = false;
        rerender();
        act(() => {
            result.current.store.dispatch({type: GeneralTypes.WEBSOCKET_SUCCESS, timestamp: 100});
        });

        // Only the reusing mounts remain, and together they send one request.
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(result.current.a.loading).toBe(false));
        expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    test('does not fetch when skipped', () => {
        const {result} = renderHookWithContext(() => useChannelAttributes({skip: true}), stateWith({groupResolved: true}));

        expect(result.current.enabled).toBe(false);
        expect(result.current.fields).toEqual([]);
        expect(mockedFetch).not.toHaveBeenCalled();
    });

    test('the missing-required indicator path sends no fields request while Required is off', () => {
        const state = stateWith({groupResolved: false}) as {entities: {general: {config: Record<string, string>}}};
        state.entities.general.config.FeatureFlagChannelAttributesRequired = 'false';

        renderHookWithContext(() => useMissingRequiredChannelAttributes('channel1', {preferStore: true}), state as PartialState);

        expect(mockedFetch).not.toHaveBeenCalled();
    });
});
