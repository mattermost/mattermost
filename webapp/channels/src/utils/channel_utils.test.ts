// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ArchiveLockOutlineIcon, ArchiveOutlineIcon, GlobeIcon, LockOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import * as Utils from 'utils/channel_utils';
import Constants from 'utils/constants';

describe('Channel Utils', () => {
    describe('findNextUnreadChannelId', () => {
        test('no channels are unread', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds: string[] = [];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(-1);
        });

        test('only current channel is unread', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['3'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(-1);
        });

        test('going forward to unread channels', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['1', '4', '5'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(3);
        });

        test('going forward to unread channels with wrapping', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['1', '2'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(0);
        });

        test('going backwards to unread channels', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['1', '4', '5'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, -1)).toEqual(0);
        });

        test('going backwards to unread channels with wrapping', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['3', '4', '5'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, -1)).toEqual(4);
        });
    });

    describe('getArchiveIconComponent', () => {
        test('should return ArchiveLockOutlineIcon for private channels', () => {
            const icon = Utils.getArchiveIconComponent(Constants.PRIVATE_CHANNEL);
            expect(icon).toBe(ArchiveLockOutlineIcon);
        });

        test('should return ArchiveOutlineIcon for public channels', () => {
            const icon = Utils.getArchiveIconComponent(Constants.OPEN_CHANNEL);
            expect(icon).toBe(ArchiveOutlineIcon);
        });

        test('should return ArchiveOutlineIcon for DM channels', () => {
            const icon = Utils.getArchiveIconComponent(Constants.DM_CHANNEL);
            expect(icon).toBe(ArchiveOutlineIcon);
        });

        test('should return ArchiveOutlineIcon for GM channels', () => {
            const icon = Utils.getArchiveIconComponent(Constants.GM_CHANNEL);
            expect(icon).toBe(ArchiveOutlineIcon);
        });

        test('should return ArchiveOutlineIcon when channelType is undefined', () => {
            const icon = Utils.getArchiveIconComponent(undefined);
            expect(icon).toBe(ArchiveOutlineIcon);
        });
    });

    describe('getArchiveIconClassName', () => {
        test('should return icon-archive-lock-outline for private channels', () => {
            const className = Utils.getArchiveIconClassName(Constants.PRIVATE_CHANNEL);
            expect(className).toBe('icon-archive-lock-outline');
        });

        test('should return icon-archive-outline for public channels', () => {
            const className = Utils.getArchiveIconClassName(Constants.OPEN_CHANNEL);
            expect(className).toBe('icon-archive-outline');
        });

        test('should return icon-archive-outline for DM channels', () => {
            const className = Utils.getArchiveIconClassName(Constants.DM_CHANNEL);
            expect(className).toBe('icon-archive-outline');
        });

        test('should return icon-archive-outline for GM channels', () => {
            const className = Utils.getArchiveIconClassName(Constants.GM_CHANNEL);
            expect(className).toBe('icon-archive-outline');
        });

        test('should return icon-archive-outline when channelType is undefined', () => {
            const className = Utils.getArchiveIconClassName(undefined);
            expect(className).toBe('icon-archive-outline');
        });
    });

    describe('getChannelIconComponent', () => {
        test('should return ArchiveLockOutlineIcon for archived private channel', () => {
            const channel = {
                type: Constants.PRIVATE_CHANNEL,
                delete_at: 1234567890,
            } as Channel;
            const icon = Utils.getChannelIconComponent(channel);
            expect(icon).toBe(ArchiveLockOutlineIcon);
        });

        test('should return ArchiveOutlineIcon for archived public channel', () => {
            const channel = {
                type: Constants.OPEN_CHANNEL,
                delete_at: 1234567890,
            } as Channel;
            const icon = Utils.getChannelIconComponent(channel);
            expect(icon).toBe(ArchiveOutlineIcon);
        });

        test('should return LockOutlineIcon for active private channel', () => {
            const channel = {
                type: Constants.PRIVATE_CHANNEL,
                delete_at: 0,
            } as Channel;
            const icon = Utils.getChannelIconComponent(channel);
            expect(icon).toBe(LockOutlineIcon);
        });

        test('should return GlobeIcon for active public channel', () => {
            const channel = {
                type: Constants.OPEN_CHANNEL,
                delete_at: 0,
            } as Channel;
            const icon = Utils.getChannelIconComponent(channel);
            expect(icon).toBe(GlobeIcon);
        });

        test('should return GlobeIcon for DM channel', () => {
            const channel = {
                type: Constants.DM_CHANNEL,
                delete_at: 0,
            } as Channel;
            const icon = Utils.getChannelIconComponent(channel);
            expect(icon).toBe(GlobeIcon);
        });

        test('should return GlobeIcon for GM channel', () => {
            const channel = {
                type: Constants.GM_CHANNEL,
                delete_at: 0,
            } as Channel;
            const icon = Utils.getChannelIconComponent(channel);
            expect(icon).toBe(GlobeIcon);
        });

        test('should return GlobeIcon when channel is undefined', () => {
            const icon = Utils.getChannelIconComponent(undefined);
            expect(icon).toBe(GlobeIcon);
        });
    });

    describe('isArchivedChannel', () => {
        test('returns false for undefined', () => {
            expect(Utils.isArchivedChannel(undefined)).toBe(false);
        });

        test('returns false for channel object missing delete_at', () => {
            expect(Utils.isArchivedChannel({} as Channel)).toBe(false);
        });

        test('returns false for channel with delete_at: 0', () => {
            expect(Utils.isArchivedChannel({delete_at: 0} as Channel)).toBe(false);
        });

        test('returns true for channel with delete_at: 12345', () => {
            expect(Utils.isArchivedChannel({delete_at: 12345} as Channel)).toBe(true);
        });

        test('returns true for channel with delete_at: -1', () => {
            expect(Utils.isArchivedChannel({delete_at: -1} as Channel)).toBe(true);
        });

        test('getChannelIconClassName returns icon-globe for open channel missing delete_at', () => {
            expect(Utils.getChannelIconClassName({type: 'O'} as Channel)).toBe('icon-globe');
        });
    });

    describe('getChannelRoutePathAndIdentifier', () => {
        test('should return channels path and channel name for open channels', () => {
            const channel = {type: Constants.OPEN_CHANNEL, name: 'town-square'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel);
            expect(result).toEqual({path: 'channels', identifier: 'town-square'});
        });

        test('should return channels path and channel name for private channels', () => {
            const channel = {type: Constants.PRIVATE_CHANNEL, name: 'secret-ops'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel);
            expect(result).toEqual({path: 'channels', identifier: 'secret-ops'});
        });

        test('should return messages path and @username for DM channels when dmUsername is provided', () => {
            const channel = {type: Constants.DM_CHANNEL, name: 'user1__user2'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel, 'johndoe');
            expect(result).toEqual({path: 'messages', identifier: '@johndoe'});
        });

        test('should return messages path and channel name for DM channels when dmUsername is not provided', () => {
            const channel = {type: Constants.DM_CHANNEL, name: 'user1__user2'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel);
            expect(result).toEqual({path: 'messages', identifier: 'user1__user2'});
        });

        test('should return messages path and group id for GM channels', () => {
            const channel = {type: Constants.GM_CHANNEL, name: 'abcdef1234567890abcdef1234567890abcdefgh'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel);
            expect(result).toEqual({path: 'messages', identifier: 'abcdef1234567890abcdef1234567890abcdefgh'});
        });

        test('should ignore dmUsername for non-DM channels', () => {
            const channel = {type: Constants.OPEN_CHANNEL, name: 'town-square'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel, 'johndoe');
            expect(result).toEqual({path: 'channels', identifier: 'town-square'});
        });

        test('should ignore dmUsername for GM channels', () => {
            const channel = {type: Constants.GM_CHANNEL, name: 'groupid1234'} as Channel;
            const result = Utils.getChannelRoutePathAndIdentifier(channel, 'johndoe');
            expect(result).toEqual({path: 'messages', identifier: 'groupid1234'});
        });
    });

    describe('isMembershipPolicyEnforced', () => {
        test('returns false for null/undefined channel', () => {
            expect(Utils.isMembershipPolicyEnforced(null)).toBe(false);
            expect(Utils.isMembershipPolicyEnforced(undefined)).toBe(false);
        });

        test('returns false for a channel without any policy', () => {
            expect(Utils.isMembershipPolicyEnforced({})).toBe(false);
            expect(Utils.isMembershipPolicyEnforced({policy_enforced: false})).toBe(false);
        });

        test('returns true when policy_actions.membership is true (preferred path)', () => {
            // When policy_actions is present, the helper trusts it over the
            // broader policy_enforced flag — this is the whole point of the
            // Phase 2 migration.
            expect(Utils.isMembershipPolicyEnforced({
                policy_enforced: true,
                policy_actions: {membership: true},
            })).toBe(true);
        });

        test('returns false for permission-only policy (the bug-fix invariant)', () => {
            // policy_enforced=true but no membership action — the consumer
            // must NOT treat this as a membership-controlled channel. This
            // is the regression test for the permission-only-policy bug.
            expect(Utils.isMembershipPolicyEnforced({
                policy_enforced: true,
                policy_actions: {upload_file_attachment: true},
            })).toBe(false);
        });

        test('falls back to policy_enforced when policy_actions is undefined (backward compat)', () => {
            // Older server builds or unhydrated read paths leave
            // policy_actions undefined. We degrade to the legacy
            // "policy_enforced means membership" behavior so we never
            // regress relative to today.
            expect(Utils.isMembershipPolicyEnforced({policy_enforced: true})).toBe(true);
            expect(Utils.isMembershipPolicyEnforced({policy_enforced: false})).toBe(false);
        });

        test('empty policy_actions map is treated as "no actions" (fail-closed for membership)', () => {
            // The server sets an empty map when the policy was deleted
            // between channel read and hydration. We must NOT fall back to
            // policy_enforced in that case — the hydrator's empty-map
            // signal is authoritative.
            expect(Utils.isMembershipPolicyEnforced({
                policy_enforced: true,
                policy_actions: {},
            })).toBe(false);
        });
    });

    describe('isChannelAccessControlled', () => {
        test('returns true whenever policy_enforced is true, regardless of action set', () => {
            // Admin console toggles and useChannelSystemPolicies care
            // about ANY policy attached, including permission-only ones —
            // the function intentionally only consults policy_enforced and
            // never reads policy_actions, which the type signature enforces.
            expect(Utils.isChannelAccessControlled({policy_enforced: true})).toBe(true);
        });

        test('returns false when policy_enforced is missing or false', () => {
            expect(Utils.isChannelAccessControlled(null)).toBe(false);
            expect(Utils.isChannelAccessControlled(undefined)).toBe(false);
            expect(Utils.isChannelAccessControlled({})).toBe(false);
            expect(Utils.isChannelAccessControlled({policy_enforced: false})).toBe(false);
        });
    });
});
