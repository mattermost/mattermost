// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    channelRolesMatchingTarget,
    draftRoleAppliesToSubjectRole,
    isChannelRole,
    pickChannelRoleFromTokens,
    pickSystemRoleFromTokens,
    roleChain,
    userIsSystemAdmin,
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

        // Channel users do NOT inherit guest scope (guest is a separate
        // role, not a fallback target). The earlier suite was missing
        // this assertion, so a regression that flipped the fallback
        // would have gone uncaught.
        expect(draftRoleAppliesToSubjectRole('channel_guest', 'channel', 'channel_user')).toBe(false);
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

    test('system scope with a channel-scoped target role accepts every user (system-console permission policy edge case)', () => {
        // System-console permission policies live at system scope but
        // their rules carry channel_* role names because the rules
        // govern per-channel actions. Without channel context the
        // picker can't determine applicability, so it must defer to
        // the server's no_applicable_policy attribution at simulate
        // time — every user is a candidate, and the simulator marks
        // mismatches at evaluation. Without this carve-out NOBODY
        // would appear in the picker for channel-targeting system
        // rules, since channel_* never appears in a system role chain.
        expect(userMatchesTargetRole({roles: 'system_user'}, 'channel_user', 'system')).toBe(true);
        expect(userMatchesTargetRole({roles: 'system_admin'}, 'channel_user', 'system')).toBe(true);
        expect(userMatchesTargetRole({roles: 'system_user'}, 'channel_admin', 'system')).toBe(true);
        expect(userMatchesTargetRole({roles: 'system_guest'}, 'channel_guest', 'system')).toBe(true);
    });

    test('system scope with a system-scoped target role still applies the chain (regression guard)', () => {
        expect(userMatchesTargetRole({roles: 'system_user'}, 'system_user', 'system')).toBe(true);
        expect(userMatchesTargetRole({roles: 'system_user'}, 'system_admin', 'system')).toBe(false);
    });
});

describe('isChannelRole', () => {
    test('recognises the three channel-scoped roles', () => {
        expect(isChannelRole('channel_admin')).toBe(true);
        expect(isChannelRole('channel_user')).toBe(true);
        expect(isChannelRole('channel_guest')).toBe(true);
    });

    test('rejects system-scoped roles, empty input, and unknown tokens', () => {
        expect(isChannelRole('system_admin')).toBe(false);
        expect(isChannelRole('system_user')).toBe(false);
        expect(isChannelRole('system_guest')).toBe(false);
        expect(isChannelRole('')).toBe(false);
        expect(isChannelRole('custom_role')).toBe(false);
    });
});

describe('pickChannelRoleFromTokens', () => {
    test('picks channel_admin when present, even alongside channel_user', () => {
        // ChannelMember.roles is space-separated and admins typically
        // carry both tokens. The picker treats them as effective admins.
        expect(pickChannelRoleFromTokens('channel_user channel_admin')).toBe('channel_admin');
        expect(pickChannelRoleFromTokens('channel_admin channel_user')).toBe('channel_admin');
    });

    test('falls back through channel_guest before channel_user', () => {
        expect(pickChannelRoleFromTokens('channel_guest')).toBe('channel_guest');
        expect(pickChannelRoleFromTokens('channel_user')).toBe('channel_user');
    });

    test('returns empty for empty input or no recognised tokens', () => {
        expect(pickChannelRoleFromTokens('')).toBe('');
        expect(pickChannelRoleFromTokens('custom_channel_role')).toBe('');
    });
});

describe('userIsSystemAdmin', () => {
    test('returns true when system_admin appears in role tokens', () => {
        expect(userIsSystemAdmin({roles: 'system_admin'})).toBe(true);
        expect(userIsSystemAdmin({roles: 'system_user system_admin'})).toBe(true);
    });

    test('returns false for non-admins', () => {
        expect(userIsSystemAdmin({roles: 'system_user'})).toBe(false);
        expect(userIsSystemAdmin({roles: 'system_guest'})).toBe(false);
        expect(userIsSystemAdmin({roles: ''})).toBe(false);
    });
});
