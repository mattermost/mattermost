// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyValue} from '@mattermost/types/properties';

import {PropertyTypes} from 'mattermost-redux/action_types';

import {handlePropertyValuesUpdated} from 'actions/websocket_actions';

import mockStore from 'tests/test_store';

// The server emits four payloads under one property_values_updated event,
// distinguished only by which keys are present. See the Go-side contract in
// TestPropertyValuesUpdatedPayloadShapes; these assert the client half.

const CHANNEL_ID = 'channel_id_1';
const FIELD_ID = 'field_id_1';
const GROUP_ID = 'group_id_1';

function storedValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value_id_1',
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: FIELD_ID,
        value: 'AURORA',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    };
}

function dispatchEvent(data: Record<string, unknown>) {
    const store = mockStore({
        entities: {
            general: {config: {}, license: {}},
            properties: {
                fields: {byId: {}, byObjectType: {}},
                values: {byTargetId: {}, byFieldId: {}},
                groups: {byId: {}, byName: {}},
            },
            channelCategories: {byId: {}, orderByTeam: {}},
        },
    });

    const msg = {
        event: 'property_values_updated',
        data,
        broadcast: {omit_users: null, user_id: '', channel_id: CHANNEL_ID, team_id: ''},
        seq: 1,
    };

    store.dispatch(handlePropertyValuesUpdated(msg as any) as any);
    return store.getActions().flatMap((action: any) => (Array.isArray(action) ? action : [action]));
}

function typesOf(actions: any[]): string[] {
    return actions.map((action) => action.type);
}

describe('property_values_updated payload shapes', () => {
    test('shape 1: upsert stores the values', () => {
        const actions = dispatchEvent({
            object_type: 'channel',
            target_id: CHANNEL_ID,
            values: JSON.stringify([storedValue()]),
        });

        expect(typesOf(actions)).toContain(PropertyTypes.RECEIVED_PROPERTY_VALUES);
        const received = actions.find((a) => a.type === PropertyTypes.RECEIVED_PROPERTY_VALUES);
        expect(received.data.values[0].value).toBe('AURORA');
    });

    test('shape 1b: a null-valued row is stored, not deleted', () => {
        // The user-initiated clear keeps the row. No delete event ever arrives,
        // so removing it here would leave the client waiting for one.
        const actions = dispatchEvent({
            object_type: 'channel',
            target_id: CHANNEL_ID,
            values: JSON.stringify([storedValue({value: null})]),
        });

        expect(typesOf(actions)).toContain(PropertyTypes.RECEIVED_PROPERTY_VALUES);
        expect(typesOf(actions)).not.toContain(PropertyTypes.PROPERTY_VALUE_DELETED);
    });

    test('shape 2: a tombstone deletes the row rather than storing a blank one', () => {
        // Identical to shape 1b on the wire apart from the empty id.
        const actions = dispatchEvent({
            object_type: 'channel',
            target_id: CHANNEL_ID,
            values: JSON.stringify([storedValue({id: '', value: null})]),
        });

        expect(typesOf(actions)).toContain(PropertyTypes.PROPERTY_VALUE_DELETED);
        expect(typesOf(actions)).not.toContain(PropertyTypes.RECEIVED_PROPERTY_VALUES);

        const deleted = actions.find((a) => a.type === PropertyTypes.PROPERTY_VALUE_DELETED);
        expect(deleted.data).toEqual({targetId: CHANNEL_ID, fieldId: FIELD_ID});
    });

    test('shape 3: an empty array clears only that target', () => {
        const actions = dispatchEvent({
            object_type: 'channel',
            target_id: CHANNEL_ID,
            values: '[]',
        });

        expect(typesOf(actions)).toContain(PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET);
        const cleared = actions.find((a) => a.type === PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET);
        expect(cleared.data).toEqual({targetId: CHANNEL_ID});
    });

    test('shape 4: field_id with no target clears that field everywhere', () => {
        const actions = dispatchEvent({
            field_id: FIELD_ID,
            values: '[]',
        });

        expect(typesOf(actions)).toContain(PropertyTypes.PROPERTY_VALUES_DELETED_FOR_FIELD);
        const cleared = actions.find((a) => a.type === PropertyTypes.PROPERTY_VALUES_DELETED_FOR_FIELD);
        expect(cleared.data).toEqual({fieldId: FIELD_ID});

        // Must not be mistaken for a target-scoped clear, which would wipe an
        // unrelated channel instead of one attribute.
        expect(typesOf(actions)).not.toContain(PropertyTypes.PROPERTY_VALUES_DELETED_FOR_TARGET);
    });

    test('malformed JSON is ignored', () => {
        const actions = dispatchEvent({object_type: 'channel', target_id: CHANNEL_ID, values: 'not json'});

        expect(typesOf(actions)).not.toContain(PropertyTypes.RECEIVED_PROPERTY_VALUES);
        expect(typesOf(actions)).not.toContain(PropertyTypes.PROPERTY_VALUE_DELETED);
    });
});
