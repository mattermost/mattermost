// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderHookWithContext} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';

import type {GlobalState} from 'types/store';

import useChannelAttributes from './useChannelAttributes';
import useFixableMissingRequiredAttributes from './useFixableMissingRequiredAttributes';

jest.mock('./useChannelAttributes');
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getPropertyValues: jest.fn(),
    },
}));

let mockChannelPermissions: Record<string, boolean> = {};
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn().mockImplementation((_state, _teamId, _channelId, permission) => (
        mockChannelPermissions[permission] ?? false
    )),
}));

const mockUseChannelAttributes = jest.mocked(useChannelAttributes);
const mockGetPropertyValues = jest.mocked(Client4.getPropertyValues);

const CHANNEL_ID = 'channel1';

function field(id: string, overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id,
        group_id: 'group1',
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: 'admin',
        attrs: {required: true, display_name: id, options: [{id: 'o1', name: 'One'}]},
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        ...overrides,
    };
}

type StateOptions = {
    channelType?: string;
    deleteAt?: number;
    isSystemAdmin?: boolean;
    requiredFlag?: string;
};

function makeState({channelType = 'O', deleteAt = 0, isSystemAdmin = false, requiredFlag = 'true'}: StateOptions = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {
                    FeatureFlagChannelAttributes: 'true',
                    FeatureFlagChannelAttributesRequired: requiredFlag,
                },
            },
            channels: {
                channels: {[CHANNEL_ID]: {id: CHANNEL_ID, team_id: 'team1', type: channelType, delete_at: deleteAt}},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1', roles: isSystemAdmin ? 'system_admin' : 'system_user'}},
            },
            properties: {
                values: {byTargetId: {}, byFieldId: {}},
                loadedValueTargets: {[CHANNEL_ID]: true},
            },
        },
    } as DeepPartial<GlobalState>;
}

function useFields(fields: PropertyField[], enabled = true) {
    mockUseChannelAttributes.mockReturnValue({enabled, loading: false, failed: false, fields: enabled ? fields : []});
}

describe('useFixableMissingRequiredAttributes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        useFields([field('program')]);
    });

    test('a channel admin gets the missing fields in order, with the first one named', () => {
        useFields([field('program'), field('classification')]);
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState());

        expect(result.current.fields.map((f) => f.id)).toEqual(['program', 'classification']);
        expect(result.current.firstFieldId).toBe('program');
    });

    test('a system admin gets a sysadmin-level field', () => {
        mockChannelPermissions = {};
        useFields([field('program', {permission_values: 'sysadmin'})]);
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState({isSystemAdmin: true}));

        expect(result.current.fields.map((f) => f.id)).toEqual(['program']);
    });

    test('a plain member gets nothing', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: false};
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState());

        expect(result.current.fields).toEqual([]);
        expect(result.current.firstFieldId).toBeUndefined();
    });

    test('a channel admin does not get a sysadmin-level field', () => {
        useFields([field('program', {permission_values: 'sysadmin'})]);
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState());

        expect(result.current.fields).toEqual([]);
    });

    test('nobody but the integration gets a none-level field', () => {
        useFields([field('program', {permission_values: 'none'})]);
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState({isSystemAdmin: true}));

        expect(result.current.fields).toEqual([]);
    });

    test('a field type with no editor is left out', () => {
        useFields([field('joined', {type: 'date'}), field('program')]);
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState());

        expect(result.current.fields.map((f) => f.id)).toEqual(['program']);
    });

    test.each([
        ['an archived channel', {deleteAt: 5}],
        ['a direct message', {channelType: 'D'}],
        ['a group message', {channelType: 'G'}],
    ])('%s gets nothing and loads nothing', (_name, options) => {
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState(options));

        expect(result.current.fields).toEqual([]);
        expect(mockGetPropertyValues).not.toHaveBeenCalled();
    });

    test('a board gets nothing', () => {
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), mergeObjects(makeState(), boardChannelsState(CHANNEL_ID)));

        expect(result.current.fields).toEqual([]);
    });

    test('nothing while the required flag is off', () => {
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState({requiredFlag: 'false'}));

        expect(result.current.fields).toEqual([]);
        expect(mockGetPropertyValues).not.toHaveBeenCalled();
    });

    test('nothing while channel attributes are unavailable (flag or license)', () => {
        useFields([field('program')], false);
        const {result} = renderHookWithContext(() => useFixableMissingRequiredAttributes(CHANNEL_ID), makeState());

        expect(result.current.fields).toEqual([]);
        expect(mockGetPropertyValues).not.toHaveBeenCalled();
    });
});
