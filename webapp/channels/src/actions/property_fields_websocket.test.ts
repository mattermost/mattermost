// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {fetchPropertyFields} from 'mattermost-redux/actions/properties';

import {handlePropertyFieldCreatedOrUpdated} from 'actions/websocket_actions';

import mockStore from 'tests/test_store';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => ({type: ''})),
}));

const CHANNEL_ID = 'channel_id_1';
const FIELD_ID = 'field_id_1';
const GROUP_ID = 'group_id_1';
const GROUP_NAME = 'group_name_1';

const CACHED_OPTIONS = [{id: 'option_id_1', name: 'AURORA'}];

function storedField(overrides: Record<string, unknown> = {}): PropertyField {
    return {
        id: FIELD_ID,
        group_id: GROUP_ID,
        name: 'Classification',
        type: 'select',
        attrs: {options: CACHED_OPTIONS, options_count: 1},
        target_id: CHANNEL_ID,
        target_type: 'channel',
        object_type: 'channel',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    } as PropertyField;
}

function dispatchEvent(field: Record<string, unknown>, {cachedField, cachedGroup = true}: {cachedField?: PropertyField; cachedGroup?: boolean} = {}) {
    const store = mockStore({
        entities: {
            general: {config: {}, license: {}},
            properties: {
                fields: {
                    byId: cachedField ? {[FIELD_ID]: cachedField} : {},
                    byObjectType: {},
                },
                values: {byTargetId: {}, byFieldId: {}},
                groups: {
                    byId: cachedGroup ? {[GROUP_ID]: {id: GROUP_ID, name: GROUP_NAME}} : {},
                    byName: {},
                },
            },
            channelCategories: {byId: {}, orderByTeam: {}},
        },
    });

    const msg = {
        event: 'property_field_updated',
        data: {property_field: JSON.stringify(field), object_type: 'channel'},
        broadcast: {omit_users: null, user_id: '', channel_id: CHANNEL_ID, team_id: ''},
        seq: 1,
    };

    store.dispatch(handlePropertyFieldCreatedOrUpdated(msg as any) as any);
    return store.getActions().flatMap((action: any) => (Array.isArray(action) ? action : [action]));
}

function receivedField(actions: any[]): any {
    return actions.find((a) => a.type === PropertyTypes.RECEIVED_PROPERTY_FIELDS)?.data.fields[0];
}

describe('property_field_updated withheld option lists', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('a withheld field keeps the cached options and triggers a refetch', () => {
        const eventField = storedField({attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField, {cachedField: storedField()});

        expect(receivedField(actions).attrs.options).toEqual(CACHED_OPTIONS);
        expect(receivedField(actions).attrs.options_count).toBe(1);
        expect(fetchPropertyFields).toHaveBeenCalledWith(GROUP_NAME, 'channel', 'channel', CHANNEL_ID);
    });

    test('an unmarked field is stored as received and triggers no refetch', () => {
        // No options_omitted marker: a genuinely option-less field is
        // indistinguishable from a withheld one without it, so the handler
        // keys on the marker alone.
        const eventField = storedField({attrs: {}});
        const actions = dispatchEvent(eventField, {cachedField: storedField()});

        expect(receivedField(actions).attrs.options).toBeUndefined();
        expect(fetchPropertyFields).not.toHaveBeenCalled();
    });

    test('a withheld field with nothing cached is stored as received, refetch still fires', () => {
        const eventField = storedField({attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField);

        expect(receivedField(actions).attrs.options).toBeUndefined();
        expect(fetchPropertyFields).toHaveBeenCalledWith(GROUP_NAME, 'channel', 'channel', CHANNEL_ID);
    });

    test('a withheld field whose group is unknown triggers no refetch', () => {
        const eventField = storedField({attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField, {cachedField: storedField(), cachedGroup: false});

        expect(receivedField(actions).attrs.options).toEqual(CACHED_OPTIONS);
        expect(fetchPropertyFields).not.toHaveBeenCalled();
    });

    test("a withheld field still applies the event's other changes", () => {
        const eventField = storedField({name: 'Renamed', attrs: {options_omitted: true}});
        const actions = dispatchEvent(eventField, {cachedField: storedField()});

        expect(receivedField(actions).name).toBe('Renamed');
        expect(receivedField(actions).attrs.options).toEqual(CACHED_OPTIONS);
    });
});
