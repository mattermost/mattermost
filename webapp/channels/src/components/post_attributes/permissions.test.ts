// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {PropertyField, PropertyPermissionLevel} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {General, Permissions} from 'mattermost-redux/constants';

import {TestHelper} from 'utils/test_helper';

import {canEditPostAttributeValue, isChannelPropertyAdmin} from './permissions';

const AUTHOR_ID = 'user_author';
const OTHER_ID = 'user_other';

function makeField(permissionValues?: PropertyPermissionLevel, objectType = 'post'): PropertyField {
    return {
        id: 'field_1',
        group_id: 'group_1',
        name: 'classification',
        type: 'select',
        object_type: objectType,
        target_type: 'channel',
        target_id: 'channel_1',
        permission_values: permissionValues,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
    };
}

const post = TestHelper.getPostMock({id: 'post_1', user_id: AUTHOR_ID});

describe('canEditPostAttributeValue', () => {
    // The trap. An absent permission_values is a legacy field, and
    // SessionHasPermissionToSetPropertyFieldValues rejects it outright
    // (app/authorization.go:539-541) — a permissive default here would offer an
    // edit the server refuses every single time.
    it('denies a field with no permission_values at all, for everyone', () => {
        const field = makeField(undefined);

        expect(canEditPostAttributeValue(field, post, AUTHOR_ID, false, false)).toBe(false);
        expect(canEditPostAttributeValue(field, post, OTHER_ID, false, false)).toBe(false);
        expect(canEditPostAttributeValue(field, post, AUTHOR_ID, true, false)).toBe(false);
        expect(canEditPostAttributeValue(field, post, OTHER_ID, true, false)).toBe(false);

        // And a channel admin is no more entitled to it than anyone else.
        expect(canEditPostAttributeValue(field, post, AUTHOR_ID, false, true)).toBe(false);
        expect(canEditPostAttributeValue(field, post, OTHER_ID, false, true)).toBe(false);
        expect(canEditPostAttributeValue(field, post, AUTHOR_ID, true, true)).toBe(false);
        expect(canEditPostAttributeValue(field, post, OTHER_ID, true, true)).toBe(false);
    });

    // The function is named for posts and resolves against a post. A field of
    // any other object_type is a caller error, and the most permissive level is
    // the one that proves the guard runs before the switch rather than after.
    it('denies a field that is not post-object, however permissive the level', () => {
        for (const objectType of ['channel', 'user', 'system', '']) {
            expect(canEditPostAttributeValue(makeField('member', objectType), post, AUTHOR_ID, true, true)).toBe(false);
            expect(canEditPostAttributeValue(makeField('admin', objectType), post, AUTHOR_ID, true, true)).toBe(false);
            expect(canEditPostAttributeValue(makeField('creator', objectType), post, AUTHOR_ID, true, true)).toBe(false);
        }

        // Same level, same user, post-object: allowed. Isolates object_type as
        // the only thing the assertions above are measuring.
        expect(canEditPostAttributeValue(makeField('member'), post, AUTHOR_ID, true, true)).toBe(true);
    });

    it("denies 'none' even to a system admin", () => {
        const field = makeField('none');

        expect(canEditPostAttributeValue(field, post, OTHER_ID, false, false)).toBe(false);
        expect(canEditPostAttributeValue(field, post, AUTHOR_ID, false, false)).toBe(false);
        expect(canEditPostAttributeValue(field, post, OTHER_ID, true, false)).toBe(false);

        // Nor to a channel admin.
        expect(canEditPostAttributeValue(field, post, OTHER_ID, false, true)).toBe(false);
    });

    it("allows 'member' for a plain member who did not write the post", () => {
        expect(canEditPostAttributeValue(makeField('member'), post, OTHER_ID, false, false)).toBe(true);
    });

    describe("'sysadmin'", () => {
        it('allows a system admin', () => {
            expect(canEditPostAttributeValue(makeField('sysadmin'), post, OTHER_ID, true, false)).toBe(true);
        });

        it('denies a plain member, including the post author', () => {
            expect(canEditPostAttributeValue(makeField('sysadmin'), post, OTHER_ID, false, false)).toBe(false);
            expect(canEditPostAttributeValue(makeField('sysadmin'), post, AUTHOR_ID, false, false)).toBe(false);
        });

        it('denies a channel admin who is not a system admin', () => {
            expect(canEditPostAttributeValue(makeField('sysadmin'), post, OTHER_ID, false, true)).toBe(false);
            expect(canEditPostAttributeValue(makeField('sysadmin'), post, AUTHOR_ID, false, true)).toBe(false);
        });
    });

    describe("'creator'", () => {
        it('allows the post author', () => {
            expect(canEditPostAttributeValue(makeField('creator'), post, AUTHOR_ID, false, false)).toBe(true);
        });

        it('denies another member', () => {
            expect(canEditPostAttributeValue(makeField('creator'), post, OTHER_ID, false, false)).toBe(false);
        });

        it('allows a system admin who did not write the post', () => {
            expect(canEditPostAttributeValue(makeField('creator'), post, OTHER_ID, true, false)).toBe(true);
        });

        // hasPropertyFieldValueCreator checks post.UserId == userID and then
        // falls through to hasPropertyFieldValueAdmin unconditionally
        // (app/authorization.go:748), so a channel admin qualifies without
        // having written the post.
        it('allows a channel admin who did not write the post', () => {
            expect(canEditPostAttributeValue(makeField('creator'), post, OTHER_ID, false, true)).toBe(true);
        });
    });

    describe("'admin'", () => {
        // Was `return true` for everyone, deliberately, because the helper had
        // no membership fact to resolve against. It has one now, so the level
        // is resolved rather than waved through.
        it('allows a channel admin', () => {
            expect(canEditPostAttributeValue(makeField('admin'), post, OTHER_ID, false, true)).toBe(true);
        });

        it('allows a system admin', () => {
            expect(canEditPostAttributeValue(makeField('admin'), post, OTHER_ID, true, false)).toBe(true);
        });

        it('denies a plain member, including the post author', () => {
            expect(canEditPostAttributeValue(makeField('admin'), post, OTHER_ID, false, false)).toBe(false);
            expect(canEditPostAttributeValue(makeField('admin'), post, AUTHOR_ID, false, false)).toBe(false);
        });
    });

    // The regression test for the whole defect this signature change exists to
    // fix. PermissionLevelCreator grants the entity's creator plus everyone
    // PermissionLevelAdmin grants (model/property_field.go:52-59), so on the
    // server 'creator' is a strict superset of 'admin'. Before the
    // isChannelPropertyAdmin parameter the helper inverted that for a channel
    // admin who was neither the author nor a system admin: 'admin' rendered
    // editable and the broader 'creator' rendered locked.
    it("admits everyone on 'creator' that it admits on 'admin', for every combination of inputs", () => {
        const adminField = makeField('admin');
        const creatorField = makeField('creator');

        for (const currentUserId of [AUTHOR_ID, OTHER_ID]) {
            for (const isSystemAdmin of [false, true]) {
                for (const isChannelAdmin of [false, true]) {
                    const combination = {currentUserId, isSystemAdmin, isChannelAdmin};
                    const admin = canEditPostAttributeValue(adminField, post, currentUserId, isSystemAdmin, isChannelAdmin);
                    const creator = canEditPostAttributeValue(creatorField, post, currentUserId, isSystemAdmin, isChannelAdmin);

                    if (admin) {
                        // Spread the combination into the assertion so a
                        // failure names which of the eight it was.
                        expect({...combination, creator}).toEqual({...combination, creator: true});
                    }
                }
            }
        }
    });
});

const CURRENT_USER_ID = 'user_current';
const TEAM_ID = 'team_1';
const CHANNEL_ID = 'channel_1';

type StateOverrides = {

    // Roles held on the channel membership, e.g. ['channel_user', 'channel_admin'].
    channelRoles?: string[];

    // System roles of the current user.
    systemRoles?: string;

    isMember?: boolean;
};

function makeState({channelRoles = ['channel_user'], systemRoles = 'system_user', isMember = true}: StateOverrides = {}): GlobalState {
    return {
        entities: {
            users: {
                currentUserId: CURRENT_USER_ID,
                profiles: {
                    [CURRENT_USER_ID]: TestHelper.getUserMock({id: CURRENT_USER_ID, roles: systemRoles}),
                },
            },
            teams: {
                myMembers: {},
            },
            channels: {
                myMembers: isMember ? {
                    [CHANNEL_ID]: TestHelper.getChannelMembershipMock({channel_id: CHANNEL_ID, user_id: CURRENT_USER_ID}),
                } : {},
                roles: isMember ? {[CHANNEL_ID]: new Set(channelRoles)} : {},
            },
            roles: {
                roles: {
                    channel_user: {permissions: [Permissions.READ_CHANNEL]},
                    channel_admin: {permissions: [Permissions.MANAGE_CHANNEL_ROLES]},
                    channel_guest: {permissions: [Permissions.READ_CHANNEL]},
                    system_user: {permissions: []},
                    system_guest: {permissions: []},
                    system_admin: {permissions: [Permissions.MANAGE_CHANNEL_ROLES]},
                },
            },
        },
    } as unknown as GlobalState;
}

function makeChannel(type: ChannelType): Channel {
    return TestHelper.getChannelMock({
        id: CHANNEL_ID,

        // DMs and GMs carry no team; haveIChannelPermission guards the empty
        // string, so it is passed through rather than special-cased.
        team_id: (type === General.DM_CHANNEL || type === General.GM_CHANNEL) ? '' : TEAM_ID,
        type,
    });
}

describe('isChannelPropertyAdmin', () => {
    it('allows a user with manage_channel_roles on the channel', () => {
        const state = makeState({channelRoles: ['channel_user', 'channel_admin']});

        expect(isChannelPropertyAdmin(state, makeChannel(General.OPEN_CHANNEL))).toBe(true);
    });

    it('denies a plain member of a public channel', () => {
        const state = makeState();

        expect(isChannelPropertyAdmin(state, makeChannel(General.OPEN_CHANNEL))).toBe(false);
    });

    it('denies a plain member of a private channel', () => {
        const state = makeState();

        expect(isChannelPropertyAdmin(state, makeChannel(General.PRIVATE_CHANNEL))).toBe(false);
    });

    // hasChannelPropertyAdmin treats every non-guest participant of a DM or GM
    // as an admin of it (app/authorization.go:633-648), because those channels
    // have no channel_admin role to hold.
    it('allows a non-guest member of a DM', () => {
        const state = makeState();

        expect(isChannelPropertyAdmin(state, makeChannel(General.DM_CHANNEL))).toBe(true);
    });

    it('allows a non-guest member of a GM', () => {
        const state = makeState();

        expect(isChannelPropertyAdmin(state, makeChannel(General.GM_CHANNEL))).toBe(true);
    });

    it('denies a guest in a DM they are a member of', () => {
        const state = makeState({systemRoles: 'system_guest', channelRoles: ['channel_guest']});

        expect(isChannelPropertyAdmin(state, makeChannel(General.DM_CHANNEL))).toBe(false);
    });

    // The server reads the isMember return of HasPermissionToChannel here and
    // throws the permission result away (app/authorization.go:327), so this
    // branch turns on literal membership rather than on read_channel.
    it('denies a non-member of a DM', () => {
        const state = makeState({isMember: false});

        expect(isChannelPropertyAdmin(state, makeChannel(General.DM_CHANNEL))).toBe(false);
    });

    it('allows a system admin on any channel type, through the permission cascade', () => {
        const state = makeState({systemRoles: 'system_user system_admin'});

        expect(isChannelPropertyAdmin(state, makeChannel(General.OPEN_CHANNEL))).toBe(true);
        expect(isChannelPropertyAdmin(state, makeChannel(General.PRIVATE_CHANNEL))).toBe(true);
        expect(isChannelPropertyAdmin(state, makeChannel(General.DM_CHANNEL))).toBe(true);
        expect(isChannelPropertyAdmin(state, makeChannel(General.GM_CHANNEL))).toBe(true);
    });
});
