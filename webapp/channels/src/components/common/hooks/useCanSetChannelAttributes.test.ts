// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import useCanSetChannelAttributes from './useCanSetChannelAttributes';

const CHANNEL_ID = 'channel1';
const TEAM_ID = 'team1';

let mockChannelPermissions: Record<string, boolean> = {};
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn().mockImplementation((_state, _teamId, _channelId, permission) => (
        mockChannelPermissions[permission] ?? false
    )),
}));

function field(permissionValues: PropertyField['permission_values'], changePolicy?: string): PropertyField {
    return {
        id: 'field1',
        group_id: 'group1',
        name: 'field1',
        type: 'text',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: permissionValues,
        attrs: {
            ...(changePolicy === undefined ? {} : {change_policy: changePolicy}),
        },
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function makeState(isSystemAdmin = false): DeepPartial<GlobalState> {
    return {
        entities: {
            channels: {
                channels: {[CHANNEL_ID]: {id: CHANNEL_ID, team_id: TEAM_ID, type: 'P'}},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1', roles: isSystemAdmin ? 'system_admin' : 'system_user'}},
            },
        },
    } as DeepPartial<GlobalState>;
}

describe('useCanSetChannelAttributes', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('unset permission_values defaults to the admin tier, not member', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: false};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field(undefined))).toBe(false);
    });

    test('unset permission_values is settable by a channel admin', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field(undefined))).toBe(true);
    });

    test('explicit member tier remains settable by any channel member', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: false};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field('member'))).toBe(true);
    });

    test('admin tier requires manage_channel_roles', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: false};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field('admin'))).toBe(false);
    });

    test('sysadmin tier refuses a channel admin who is not a system admin', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field('sysadmin'))).toBe(false);
    });

    test('sysadmin tier is settable by a system admin', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: false};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState(true));

        expect(result.current(field('sysadmin'))).toBe(true);
    });

    test('none tier is never settable', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field('none'))).toBe(false);
    });

    test('a system admin bypasses the member and admin tiers even without channel membership', () => {
        mockChannelPermissions = {read_channel: false, manage_channel_roles: false};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState(true));

        expect(result.current(field('member'))).toBe(true);
        expect(result.current(field('admin'))).toBe(true);
        expect(result.current(field('sysadmin'))).toBe(true);
    });

    test('the none tier refuses everyone, including a system admin', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState(true));

        expect(result.current(field('none'))).toBe(false);
    });

    test('a never change_policy locks an already-set value even when the tier would allow it', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
        const {result} = renderHookWithContext(() => useCanSetChannelAttributes(CHANNEL_ID), makeState());

        expect(result.current(field(undefined, 'never'), true)).toBe(false);
        expect(result.current(field(undefined, 'never'), false)).toBe(true);
    });
});
