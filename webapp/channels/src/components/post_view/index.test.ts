// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Constants} from 'utils/constants';

import {isChannelLoading} from './index';

import type {Channel} from '@mattermost/types/channels';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

describe('components/post_view/index', () => {
    test('should return false if loading a permalink view', () => {
        expect(isChannelLoading({postid: 'postId'})).toEqual(false);
    });

    test('should return true if channel or if team data is not present', () => {
        expect(isChannelLoading({}, {id: 'channelId'} as Channel)).toEqual(true);
        expect(isChannelLoading({}, undefined, {id: 'teamId'} as Team)).toEqual(true);
    });

    test('should return true if channel is a DM and indetifier is not the same as teammate name', () => {
        const channel = {type: Constants.DM_CHANNEL, name: 'myname'} as Channel;
        expect(isChannelLoading({identifier: 'otherUsername'}, channel, {id: 'teamId'} as Team, {username: 'diffrentName'} as UserProfile)).toEqual(true);
    });

    test('should return true if channel is a GM and indetifier is not the same as channel name', () => {
        const channel = {type: Constants.GM_CHANNEL, name: 'username'} as Channel;
        expect(isChannelLoading({identifier: 'notTheSameName'}, channel, {id: 'teamId'} as Team)).toEqual(true);
    });

    test('should return true if channel team id is not the same as current team id', () => {
        const channel = {type: Constants.DM_CHANNEL, name: 'username'} as Channel;
        expect(isChannelLoading({identifier: 'username'}, channel, {id: 'teamId'} as Team)).toEqual(false);
    });

    test('should return true if teamMemberships exist but team is not part of membership', () => {
        const channel = {type: Constants.DM_CHANNEL, name: 'username'} as Channel;
        expect(isChannelLoading({identifier: 'username'}, channel, {id: 'teamId'} as Team, undefined, {differentTeamId: {} as TeamMembership})).toEqual(true);
    });
});
