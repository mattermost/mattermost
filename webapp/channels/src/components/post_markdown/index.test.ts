// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import {makeGetMentionKeysForPost} from './index';

import type {GlobalState} from 'types/store';

describe('makeGetMentionKeysForPost', () => {
    const channel = TestHelper.getChannelMock({});
    const team = TestHelper.getTeamMock({group_constrained: false});
    let user = TestHelper.getUserMock({
        username: 'a123',
    });
    user = {...user,
        notify_props: {
            ...user.notify_props,
            channel: 'true',
        }};
    const group = TestHelper.getGroupMock({
        id: '123',
        name: 'developers',
        allow_reference: true,
        delete_at: 0,
    });

    const baseState = {
        entities: {
            users: {
                currentUserId: user.id,
                profiles: {
                    [user.id]: user,
                },
            },
            groups: {
                syncables: {},
                groups: {
                    [group.id]: group,
                },
                myGroups: [
                    group.id,
                ],
            },
            teams: {
                teams: {
                    [team.id]: team,
                },
                groupsAssociatedToTeam: {
                    [team.id]: {ids: []},
                },
            },
            channels: {
                channels: {
                    [channel.id]: channel,
                },
                groupsAssociatedToChannel: {
                    [channel.id]: {ids: [group]},
                },
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as GlobalState;

    it('should return all mentionKeys', () => {
        const post = TestHelper.getPostMock({
            props: {
                disable_group_highlight: false,
                mentionHighlightDisabled: false,
            },
        });
        const getMentionKeysForPost = makeGetMentionKeysForPost();
        const results = getMentionKeysForPost(baseState, post, channel);
        const expected = [{key: '@channel'}, {key: '@all'}, {key: '@here'}, {key: '@a123'}, {key: '@developers'}];
        expect(results).toEqual(expected);
    });

    it('should return mentionKeys without groups', () => {
        const post = TestHelper.getPostMock({
            props: {
                disable_group_highlight: true,
                mentionHighlightDisabled: false,
            },
        });
        const getMentionKeysForPost = makeGetMentionKeysForPost();
        const results = getMentionKeysForPost(baseState, post, channel);
        const expected = [{key: '@channel'}, {key: '@all'}, {key: '@here'}, {key: '@a123'}];
        expect(results).toEqual(expected);
    });

    it('should return group mentions and all mentions without channel mentions', () => {
        const post = TestHelper.getPostMock({
            props: {
                disable_group_highlight: false,
                mentionHighlightDisabled: true,
            },
        });
        const getMentionKeysForPost = makeGetMentionKeysForPost();
        const results = getMentionKeysForPost(baseState, post, channel);
        const expected = [{key: '@a123'}, {key: '@developers'}];
        expect(results).toEqual(expected);
    });

    it('should return all mentions without group mentions and channel mentions', () => {
        const post = TestHelper.getPostMock({
            props: {
                disable_group_highlight: true,
                mentionHighlightDisabled: true,
            },
        });
        const getMentionKeysForPost = makeGetMentionKeysForPost();
        const results = getMentionKeysForPost(baseState, post, channel);
        const expected = [{key: '@a123'}];
        expect(results).toEqual(expected);
    });
});
