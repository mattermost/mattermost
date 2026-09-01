// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useEnabledSessionAttributeFields} from './useEnabledSessionAttributeFields';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const mockFetchPropertyFields = fetchPropertyFields as jest.MockedFunction<typeof fetchPropertyFields>;

const SESSION_GROUP_UUID = 'session_attributes';

const makeField = (id: string, name: string, enabled: boolean): UserPropertyField => ({
    id,
    name,
    type: 'text',
    group_id: SESSION_GROUP_UUID,
    target_id: '',
    target_type: 'system',
    object_type: 'session',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        enabled,
    } as UserPropertyField['attrs'],
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

const stateWith = (fields: UserPropertyField[]) => ({
    entities: {
        properties: {
            fields: {
                byObjectType: {session: {[SESSION_GROUP_UUID]: fields.reduce((acc, field) => {
                    acc[field.id] = field;
                    return acc;
                }, {} as Record<string, UserPropertyField>)}},
                byId: {},
            },
            groups: {
                byId: {},
                byName: {session_attributes: {id: SESSION_GROUP_UUID, name: 'session_attributes'}},
            },
            values: {byTargetId: {}, byFieldId: {}},
        },
    },
});

describe('useEnabledSessionAttributeFields', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns only the enabled session fields and dispatches the fetch', () => {
        const enabled = makeField('s1', 'ip_address', true);
        const disabled = makeField('s2', 'network_name', false);

        const {result} = renderHookWithContext(
            () => useEnabledSessionAttributeFields(true),
            stateWith([enabled, disabled]),
        );

        expect(mockFetchPropertyFields).toHaveBeenCalledWith('session_attributes', 'session', 'system');
        expect(result.current.map((field) => field.name)).toEqual(['ip_address']);
    });

    test('returns an empty array and fires no fetch when disabled', () => {
        const enabled = makeField('s1', 'ip_address', true);

        const {result} = renderHookWithContext(
            () => useEnabledSessionAttributeFields(false),
            stateWith([enabled]),
        );

        expect(mockFetchPropertyFields).not.toHaveBeenCalled();
        expect(result.current).toEqual([]);
    });

    test('returns an empty array when the group has not resolved yet', () => {
        const {result} = renderHookWithContext(
            () => useEnabledSessionAttributeFields(true),
            {entities: {properties: {fields: {byObjectType: {}, byId: {}}, groups: {byId: {}, byName: {}}, values: {byTargetId: {}, byFieldId: {}}}}},
        );

        expect(result.current).toEqual([]);
    });
});
