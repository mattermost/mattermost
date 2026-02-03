// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import React from 'react';

import {CollapsedThreads} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ConnectedPostComponent from './index';

describe('PostComponent', () => {
    beforeAll(() => {
        Client4.setUrl('http://localhost:8065');
    });

    test('MM-62710 should attempt to load missing root post when CRT is disabled', async () => {
        const team1 = TestHelper.getTeamMock({id: 'team1'});
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: team1.id});

        const currentUser = TestHelper.getUserMock({id: 'currentUser', username: 'current_user'});
        const otherUser = TestHelper.getUserMock({id: 'otherUser', username: 'other_user'});

        const post1 = TestHelper.getPostMock({
            id: 'post1',
            user_id: otherUser.id,
            channel_id: channel1.id,
            create_at: 1000,
            message: 'This is the root post that will need to be loaded',
        });
        const post2 = TestHelper.getPostMock({
            id: 'post2',
            user_id: currentUser.id,
            channel_id: channel1.id,
            create_at: 1001,
            message: 'This is a different root post',
        });
        const post3 = TestHelper.getPostMock({
            id: 'post3',
            user_id: currentUser.id,
            channel_id: channel1.id,
            root_id: post1.id,
            create_at: 1002,
            message: 'This is the test post',
        });

        const postsMock = nock(Client4.getBaseRoute()).
            post('/posts/ids', [post1.id]).
            reply(200, [post1]);
        const usersMock = nock(Client4.getBaseRoute()).
            post('/users/ids', [otherUser.id]).
            reply(200, [otherUser]);

        renderWithContext(
            <ConnectedPostComponent
                location={Locations.CENTER}
                post={post3}
                previousPostId={post2.id}
            />,
            {
                entities: {
                    channels: {
                        channels: {
                            channel1,
                        },
                    },
                    posts: {
                        posts: {
                            post2,
                        },
                    },
                },
            },
        );

        expect(screen.getByText('This is the test post')).toBeInTheDocument();

        // The Commented on line will be missing until the root post and user are loaded
        expect(screen.queryByText('other_user')).not.toBeInTheDocument();
        expect(screen.queryByText('This is the root post that will need to be loaded')).not.toBeInTheDocument();

        // The required user and post will be loaded async
        await waitFor(() => {
            expect(screen.queryByText('other_user')).toBeInTheDocument();
            expect(screen.queryByText('This is the root post that will need to be loaded')).toBeInTheDocument();
        });

        expect(usersMock.isDone()).toBe(true);
        expect(postsMock.isDone()).toBe(true);
    });

    test('should not attempt to load missing root post when CRT is enabled', async () => {
        const team1 = TestHelper.getTeamMock({id: 'team1'});
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: team1.id});

        const currentUser = TestHelper.getUserMock({id: 'currentUser', username: 'current_user'});
        const otherUser = TestHelper.getUserMock({id: 'otherUser', username: 'other_user'});

        const post1 = TestHelper.getPostMock({
            id: 'post1',
            user_id: otherUser.id,
            channel_id: channel1.id,
            create_at: 1000,
            message: 'This is the root post that will need to be loaded',
        });
        const post2 = TestHelper.getPostMock({
            id: 'post2',
            user_id: currentUser.id,
            channel_id: channel1.id,
            create_at: 1001,
            message: 'This is a different root post',
        });
        const post3 = TestHelper.getPostMock({
            id: 'post3',
            user_id: currentUser.id,
            channel_id: channel1.id,
            root_id: post1.id,
            create_at: 1002,
            message: 'This is the test post',
        });

        const postsMock = nock(Client4.getBaseRoute()).
            post('/posts/ids', [post1.id]).
            reply(200, [post1]);
        const usersMock = nock(Client4.getBaseRoute()).
            post('/users/ids', [otherUser.id]).
            reply(200, [otherUser]);

        renderWithContext(
            <ConnectedPostComponent
                location={Locations.CENTER}
                post={post3}
                previousPostId={post2.id}
            />,
            {
                entities: {
                    channels: {
                        channels: {
                            channel1,
                        },
                    },
                    general: {
                        config: {
                            CollapsedThreads: CollapsedThreads.ALWAYS_ON,
                        },
                    },
                    posts: {
                        posts: {
                            post2,
                        },
                    },
                },
            },
        );

        expect(screen.getByText('This is the test post')).toBeInTheDocument();

        // The Commented on line will be missing until the root post and user are loaded
        expect(screen.queryByText('other_user')).not.toBeInTheDocument();
        expect(screen.queryByText('This is the root post that will need to be loaded')).not.toBeInTheDocument();

        // The required user and post will be loaded async
        await waitFor(() => {
            expect(screen.queryByText('other_user')).toBeInTheDocument();
            expect(screen.queryByText('This is the root post that will need to be loaded')).toBeInTheDocument();
        });

        expect(usersMock.isDone()).toBe(true);
        expect(postsMock.isDone()).toBe(true);
    });
});
