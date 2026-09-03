// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import useIsChannelAttributeAdmin from './useIsChannelAttributeAdmin';

let mockChannelPermissions: Record<string, boolean> = {};
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn().mockImplementation((_state, _teamId, _channelId, permission) => (
        mockChannelPermissions[permission] ?? false
    )),
}));

const CHANNEL_ID = 'channel1';

function makeState(roles: string, withChannel = true): DeepPartial<GlobalState> {
    return {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1', roles}},
            },
            channels: {
                channels: withChannel ? {[CHANNEL_ID]: {id: CHANNEL_ID, team_id: 'team1'}} : {},
            },
        },
    } as DeepPartial<GlobalState>;
}

describe('useIsChannelAttributeAdmin', () => {
    beforeEach(() => {
        mockChannelPermissions = {};
    });

    test('is true for a system admin', () => {
        const {result} = renderHookWithContext(() => useIsChannelAttributeAdmin(CHANNEL_ID), makeState('system_admin system_user'));
        expect(result.current).toBe(true);
    });

    test('is true for a channel admin, through manage_channel_roles', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};

        const {result} = renderHookWithContext(() => useIsChannelAttributeAdmin(CHANNEL_ID), makeState('system_user'));
        expect(result.current).toBe(true);
    });

    test('is false for a regular member', () => {
        mockChannelPermissions = {read_channel: true};

        const {result} = renderHookWithContext(() => useIsChannelAttributeAdmin(CHANNEL_ID), makeState('system_user'));
        expect(result.current).toBe(false);
    });

    // A system admin browsing a channel not yet in the store still administers it;
    // the channel-scoped permission is what cannot be resolved without one.
    test('falls back to the system role when the channel is not loaded', () => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};

        const member = renderHookWithContext(() => useIsChannelAttributeAdmin(CHANNEL_ID), makeState('system_user', false));
        expect(member.result.current).toBe(false);

        const admin = renderHookWithContext(() => useIsChannelAttributeAdmin(CHANNEL_ID), makeState('system_admin system_user', false));
        expect(admin.result.current).toBe(true);
    });
});
