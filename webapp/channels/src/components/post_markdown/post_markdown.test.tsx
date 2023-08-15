// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Post, PostType} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';

import {renderWithIntlAndStore, screen} from 'tests/react_testing_utils';

import {TestHelper} from 'utils/test_helper';

import PostMarkdown from './post_markdown';

describe('components/PostMarkdown', () => {
    const baseProps = {
        imageProps: {},
        message: 'message',
        post: TestHelper.getPostMock(),
        mentionKeys: [{key: 'a'}, {key: 'b'}, {key: 'c'}],
        channelId: 'channel-id',
        channel: TestHelper.getChannelMock(),
        currentTeam: TestHelper.getTeamMock(),
        hideGuestTags: false,
    };

    const state = {entities: {
        posts: {
            posts: {},
            postsInThread: {},
        },
        channels: {},
        teams: {
            teams: {
                currentTeamId: {},
            },
        },
        preferences: {
            myPreferences: {
            },
        },
        groups: {
            groups: {},
            myGroups: [],
        },
        users: {
            currentUserId: '',
            profiles: {},
        },
        emojis: {customEmoji: {}},
        general: {config: {}, license: {}},
    },
    };

    test('should not error when rendering without a post', () => {
        const props = {...baseProps};

        Reflect.deleteProperty(props, 'post');
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);

        expect(screen.getByText('message')).toBeInTheDocument();
    });

    test('should render properly with an empty post', () => {
        renderWithIntlAndStore(
            <PostMarkdown
                {...baseProps}
                post={{} as any}
            />, state);

        expect(screen.getByText('message')).toBeInTheDocument();
    });

    test('should render properly with a post', () => {
        const props = {
            ...baseProps,
            message: 'See ~test',
            post: TestHelper.getPostMock({
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                            team_name: 'test',
                        },
                    },
                },
            }),
        };
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);

        const link = screen.getByRole('link');

        expect(screen.getByText('See')).toBeInTheDocument();
        expect(link).toHaveAttribute('data-channel-mention', 'test');
        expect(link).toHaveAttribute('data-channel-mention-team', 'test');
        expect(link).toHaveAttribute('href', '/test/channels/test');
        expect(link).toHaveClass('mention-link');
    });

    test('should render properly without highlight a post', () => {
        const props = {
            ...baseProps,
            message: 'No highlight',
            options: {
                mentionHighlight: false,
            },
            post: TestHelper.getPostMock({
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                            team_name: 'test',
                        },
                    },
                },
            }),
        };
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);
        expect(screen.getByText('No highlight')).toBeInTheDocument();

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render properly without group highlight on a post', () => {
        const props = {
            ...baseProps,
            message: 'No @group highlight',
            options: {},
            post: TestHelper.getPostMock({
                props: {
                    disable_group_highlight: true,
                },
            }),
        };
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);

        const groupMention = screen.getByText('@group');

        expect(screen.getByText('No', {exact: false})).toBeInTheDocument();
        expect(groupMention).toBeInTheDocument();
        expect(groupMention).toHaveAttribute('data-mention', 'group');

        expect(groupMention).not.toHaveClass('mention-link');

        expect(screen.getByText('highlight', {exact: false})).toBeInTheDocument();
    });

    test('should correctly pass postId down', () => {
        const props = {
            ...baseProps,
            post: TestHelper.getPostMock({
                id: 'post_id',
            }),
        };
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);
        expect(screen.getByText('message')).toBeInTheDocument();
    });

    test('should render header change properly', () => {
        const props = {
            ...baseProps,
            post: TestHelper.getPostMock({
                id: 'post_id',
                type: Posts.POST_TYPES.HEADER_CHANGE as PostType,
                props: {
                    username: 'user',
                    old_header: 'see ~test',
                    new_header: 'now ~test',
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                            team_name: 'test',
                        },
                    },
                },
            }),
        };

        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);
        expect(screen.getByText('@user')).toBeInTheDocument();
        expect(screen.getByText('updated the channel header')).toBeInTheDocument();
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.getByText('see')).toBeInTheDocument();

        expect(screen.getByText('To:')).toBeInTheDocument();
        expect(screen.getByText('now')).toBeInTheDocument();

        const testLink = screen.getAllByRole('link', {name: '~Test'});
        expect(testLink).toHaveLength(2);

        expect(testLink[0]).toHaveAttribute('data-channel-mention', 'test');
        expect(testLink[0]).toHaveAttribute('data-channel-mention-team', 'test');
        expect(testLink[0]).toHaveAttribute('href', '/test/channels/test');
        expect(screen.getAllByRole('link')[0]).toHaveClass('mention-link');

        expect(testLink[1]).toHaveAttribute('data-channel-mention', 'test');
        expect(testLink[1]).toHaveAttribute('data-channel-mention-team', 'test');
        expect(testLink[1]).toHaveAttribute('href', '/test/channels/test');
        expect(screen.getAllByRole('link')[1]).toHaveClass('mention-link');
    });

    test('plugin hooks can build upon other hook message updates', () => {
        const props = {
            ...baseProps,
            message: 'world',
            post: TestHelper.getPostMock({
                message: 'world',
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
            pluginHooks: [
                {
                    hook: (post: Post, updatedMessage: string) => {
                        return 'hello ' + updatedMessage;
                    },
                },
                {
                    hook: (post: Post, updatedMessage: string) => {
                        return updatedMessage + '!';
                    },
                },
            ],
        };
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);
        expect(screen.queryByText('world', {exact: true})).not.toBeInTheDocument();

        // hook message
        expect(screen.getByText('hello world!')).toBeInTheDocument();
    });

    test('plugin hooks can overwrite other hooks messages', () => {
        const props = {
            ...baseProps,
            message: 'world',
            post: TestHelper.getPostMock({
                message: 'world',
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
            pluginHooks: [
                {
                    hook: (post: Post) => {
                        return 'hello ' + post.message;
                    },
                },
                {
                    hook: (post: Post) => {
                        return post.message + '!';
                    },
                },
            ],
        };
        renderWithIntlAndStore(<PostMarkdown {...props}/>, state);
        expect(screen.queryByText('world', {exact: true})).not.toBeInTheDocument();
        expect(screen.queryByText('world!', {exact: true})).toBeInTheDocument();
    });
});
