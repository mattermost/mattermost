// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    channelRolesMatchingTarget,
    draftRoleAppliesToSubjectRole,
    pickSystemRoleFromTokens,
    roleChain,
    userMatchesTargetRole,
} from './role_applicability';

describe('roleChain', () => {
    test('system_admin → [system_admin, system_user]', () => {
        expect(roleChain('system_admin', 'system')).toEqual(['system_admin', 'system_user']);
    });

    test('system_user → [system_user]', () => {
        expect(roleChain('system_user', 'system')).toEqual(['system_user']);
    });

    test('system_guest → [system_guest]', () => {
        expect(roleChain('system_guest', 'system')).toEqual(['system_guest']);
    });

    test('channel_admin → [channel_admin, channel_user]', () => {
        expect(roleChain('channel_admin', 'channel')).toEqual(['channel_admin', 'channel_user']);
    });

    test('channel_user → [channel_user]', () => {
        expect(roleChain('channel_user', 'channel')).toEqual(['channel_user']);
    });

    test('empty role returns empty chain', () => {
        expect(roleChain('', 'system')).toEqual([]);
    });
});

describe('draftRoleAppliesToSubjectRole — system scope', () => {
    test('system_admin draft only applies to admin users', () => {
        expect(draftRoleAppliesToSubjectRole('system_admin', 'system', 'system_admin')).toBe(true);
        expect(draftRoleAppliesToSubjectRole('system_admin', 'system', 'system_user')).toBe(false);
        expect(draftRoleAppliesToSubjectRole('system_admin', 'system', 'system_guest')).toBe(false);
    });

    test('system_user draft applies to admins (via fallback) and users', () => {
        expect(draftRoleAppliesToSubjectRole('system_user', 'system', 'system_admin')).toBe(true);
        expect(draftRoleAppliesToSubjectRole('system_user', 'system', 'system_user')).toBe(true);
        expect(draftRoleAppliesToSubjectRole('system_user', 'system', 'system_guest')).toBe(false);
    });

    test('system_guest draft only applies to guests', () => {
        expect(draftRoleAppliesToSubjectRole('system_guest', 'system', 'system_admin')).toBe(false);
        expect(draftRoleAppliesToSubjectRole('system_guest', 'system', 'system_user')).toBe(false);
        expect(draftRoleAppliesToSubjectRole('system_guest', 'system', 'system_guest')).toBe(true);
    });

    test('empty target role lets every subject through', () => {
        expect(draftRoleAppliesToSubjectRole('', 'system', 'system_user')).toBe(true);
    });

    test('empty subject role rejects everything except an empty target', () => {
        expect(draftRoleAppliesToSubjectRole('system_user', 'system', '')).toBe(false);
    });
});

describe('draftRoleAppliesToSubjectRole — channel scope', () => {
    test('channel_admin draft only applies to channel admins', () => {
        expect(draftRoleAppliesToSubjectRole('channel_admin', 'channel', 'channel_admin')).toBe(true);
        expect(draftRoleAppliesToSubjectRole('channel_admin', 'channel', 'channel_user')).toBe(false);
    });

    test('channel_user draft applies to admins (via fallback) and users', () => {
        expect(draftRoleAppliesToSubjectRole('channel_user', 'channel', 'channel_admin')).toBe(true);
        expect(draftRoleAppliesToSubjectRole('channel_user', 'channel', 'channel_user')).toBe(true);
    });

    test('channel_guest draft only applies to channel guests', () => {
        expect(draftRoleAppliesToSubjectRole('channel_guest', 'channel', 'channel_admin')).toBe(false);
        expect(draftRoleAppliesToSubjectRole('channel_guest', 'channel', 'channel_guest')).toBe(true);
    });
});

describe('pickSystemRoleFromTokens', () => {
    test('admin precedes user', () => {
        expect(pickSystemRoleFromTokens('system_user system_admin')).toBe('system_admin');
    });

    test('guest precedes user', () => {
        expect(pickSystemRoleFromTokens('system_user system_guest')).toBe('system_guest');
    });

    test('user only', () => {
        expect(pickSystemRoleFromTokens('system_user')).toBe('system_user');
    });

    test('unrecognised role returns empty', () => {
        expect(pickSystemRoleFromTokens('custom_role another_role')).toBe('');
    });

    test('empty input returns empty', () => {
        expect(pickSystemRoleFromTokens('')).toBe('');
    });
});

describe('channelRolesMatchingTarget', () => {
    test('admin target only governs channel admins', () => {
        expect(channelRolesMatchingTarget('channel_admin')).toEqual(['channel_admin']);
    });

    test('user target governs both admins (via fallback) and users', () => {
        expect(channelRolesMatchingTarget('channel_user')).toEqual(['channel_admin', 'channel_user']);
    });

    test('guest target is isolated', () => {
        expect(channelRolesMatchingTarget('channel_guest')).toEqual(['channel_guest']);
    });

    test('empty target returns no constraint list', () => {
        expect(channelRolesMatchingTarget('')).toEqual([]);
    });
});

describe('userMatchesTargetRole', () => {
    test('system scope inspects user.roles tokens', () => {
        expect(userMatchesTargetRole({roles: 'system_admin'}, 'system_admin', 'system')).toBe(true);
        expect(userMatchesTargetRole({roles: 'system_user'}, 'system_admin', 'system')).toBe(false);
    });

    test('channel scope uses provided channelMemberRole', () => {
        expect(userMatchesTargetRole({roles: 'system_user'}, 'channel_admin', 'channel', 'channel_admin')).toBe(true);
        expect(userMatchesTargetRole({roles: 'system_user'}, 'channel_admin', 'channel', 'channel_user')).toBe(false);
    });

    test('channel scope without channelMemberRole rejects (defensive)', () => {
        expect(userMatchesTargetRole({roles: 'system_user'}, 'channel_admin', 'channel')).toBe(false);
    });
});
