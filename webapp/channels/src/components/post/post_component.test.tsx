// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DeepPartial} from '@mattermost/types/utilities';
import React from 'react';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithFullContext, screen, userEvent} from 'tests/react_testing_utils';
import {GlobalState} from 'types/store';
import {getHistory} from 'utils/browser_history';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostComponent, {Props} from './post_component';

describe('PostComponent', () => {
    const currentTeam = TestHelper.getTeamMock();
    const channel = TestHelper.getChannelMock({team_id: currentTeam.id});

    const baseProps: Props = {
        center: false,
        currentTeam,
        currentUserId: 'currentUserId',
        displayName: '',
        hasReplies: false,
        isBot: false,
        isCollapsedThreadsEnabled: true,
        isFlagged: false,
        isMobileView: false,
        isPostAcknowledgementsEnabled: false,
        isPostPriorityEnabled: false,
        location: Locations.CENTER,
        post: TestHelper.getPostMock({channel_id: channel.id}),
        recentEmojis: [],
        replyCount: 0,
        team: currentTeam,
        pluginActions: [],
        actions: {
            markPostAsUnread: jest.fn(),
            emitShortcutReactToLastPostFrom: jest.fn(),
            setActionsMenuInitialisationState: jest.fn(),
            selectPost: jest.fn(),
            selectPostFromRightHandSideSearch: jest.fn(),
            removePost: jest.fn(),
            closeRightHandSide: jest.fn(),
            selectPostCard: jest.fn(),
            setRhsExpanded: jest.fn(),
        },
    };

    describe('reactions', () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                posts: {
                    reactions: {
                        [baseProps.post.id]: {
                            [`${baseProps.currentUserId}-taco`]: TestHelper.getReactionMock({emoji_name: 'taco'}),
                        },
                    },
                },
            },
        };

        test('should show reactions in the center channel', () => {
            renderWithFullContext(<PostComponent {...baseProps}/>, baseState);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });

        test('should show reactions in thread view', () => {
            const state = mergeObjects(baseState, {
                views: {
                    rhs: {
                        selectedPostId: baseProps.post.id,
                    },
                },
            });

            let props: Props = {
                ...baseProps,
                location: Locations.RHS_ROOT,
            };
            const {rerender} = renderWithFullContext(<PostComponent {...props}/>, state);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.RHS_COMMENT,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });

        test('should show only show reactions in search results with pinned/saved posts visible', () => {
            let props = {
                ...baseProps,
                location: Locations.SEARCH,
            };
            const {rerender} = renderWithFullContext(<PostComponent {...props}/>, baseState);

            expect(screen.queryByLabelText('reactions')).not.toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.SEARCH,
                isPinnedPosts: true,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.SEARCH,
                isFlaggedPosts: true,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.getByLabelText('reactions')).toBeInTheDocument();
        });
    });

    describe('thread footer', () => {
        test('should never show thread footer for a post that isn\'t part of a thread', () => {
            let props: Props = baseProps;
            const {rerender} = renderWithFullContext(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...baseProps,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();
        });

        // This probably shouldn't appear in the search results https://mattermost.atlassian.net/browse/MM-53078
        test('should only show thread footer for a root post in the center channel and search results', () => {
            const rootPost = TestHelper.getPostMock({
                id: 'rootPost',
                channel_id: channel.id,
                reply_count: 1,
            });
            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            rootPost,
                        },
                    },
                },
            };

            let props = {
                ...baseProps,
                hasReplies: true,
                post: rootPost,
                replyCount: 1,
            };
            const {rerender} = renderWithFullContext(<PostComponent {...props}/>, state);

            expect(screen.queryByText(/Follow|Following/)).toBeInTheDocument();

            props = {
                ...props,
                location: Locations.RHS_ROOT,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).toBeInTheDocument();
        });

        test('should never show thread footer for a comment', () => {
            let props = {
                ...baseProps,
                hasReplies: true,
                post: {
                    ...baseProps.post,
                    root_id: 'some_other_post_id',
                },
            };
            const {rerender} = renderWithFullContext(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.RHS_COMMENT,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();
        });

        test('should not show thread footer with CRT disabled', () => {
            const rootPost = TestHelper.getPostMock({
                id: 'rootPost',
                channel_id: channel.id,
                reply_count: 1,
            });
            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            rootPost,
                        },
                    },
                },
            };

            let props = {
                ...baseProps,
                hasReplies: true,
                isCollapsedThreadsEnabled: false,
                post: rootPost,
                replyCount: 1,
            };
            const {rerender} = renderWithFullContext(<PostComponent {...props}/>, state);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();

            props = {
                ...props,
                location: Locations.SEARCH,
            };
            rerender(<PostComponent {...props}/>);

            expect(screen.queryByText(/Follow|Following/)).not.toBeInTheDocument();
        });

        describe('reply/X replies link', () => {
            const rootPost = TestHelper.getPostMock({
                id: 'rootPost',
                channel_id: channel.id,
                reply_count: 1,
            });
            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            rootPost,
                        },
                    },
                },
            };

            const propsForRootPost = {
                ...baseProps,
                hasReplies: true,
                post: rootPost,
                replyCount: 1,
            };

            test('should select post in RHS when clicked in center channel', () => {
                renderWithFullContext(<PostComponent {...propsForRootPost}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                // Yes, this action has a different name than the one you'd expect
                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
            });

            test('should select post in RHS when clicked in center channel in a DM/GM', () => {
                const props = {
                    ...propsForRootPost,
                    team: undefined,
                };
                renderWithFullContext(<PostComponent {...props}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                // Yes, this action has a different name than the one you'd expect
                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().push).not.toHaveBeenCalled();
            });

            test('should select post in RHS when clicked in a search result on the current team', () => {
                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                };
                renderWithFullContext(<PostComponent {...props}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().push).not.toHaveBeenCalled();
            });

            test('should jump to post when clicked in a search result on another team', () => {
                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                    team: TestHelper.getTeamMock({id: 'another_team'}),
                };
                renderWithFullContext(<PostComponent {...props}/>, state);

                userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).not.toHaveBeenCalled();
                expect(getHistory().push).toHaveBeenCalled();
            });
        });
    });
});
