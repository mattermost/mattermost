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
});
