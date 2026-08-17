// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn(),
}));

jest.mock('utils/channel_utils', () => ({
    ...jest.requireActual('utils/channel_utils'),
    getArchiveIconComponent: jest.fn(() => (props: Record<string, unknown>) => (
        <span
            data-is-default-archive='true'
            {...props}
        />
    )),
}));

import {TimestampFormat} from '@mattermost/types/config';
import {PostPriority} from '@mattermost/types/posts';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Posts} from 'mattermost-redux/constants';

import {compassIconForName} from 'components/channel_type_icon';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {Locations} from 'utils/constants';
import * as PopoutWindows from 'utils/popouts/popout_windows';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostComponent from './post_component';
import type {Props} from './post_component';

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
        permissionPoliciesEnabled: false,
        location: Locations.CENTER,
        post: TestHelper.getPostMock({channel_id: channel.id}),
        recentEmojis: [],
        replyCount: 0,
        team: currentTeam,
        pluginActions: [],
        burnOnReadDurationMinutes: 10,
        actions: {
            markPostAsUnread: jest.fn(),
            emitShortcutReactToLastPostFrom: jest.fn(),
            selectPost: jest.fn(),
            selectPostFromRightHandSideSearch: jest.fn(),
            removePost: jest.fn(),
            closeRightHandSide: jest.fn(),
            selectPostCard: jest.fn(),
            setRhsExpanded: jest.fn(),
            revealBurnOnReadPost: jest.fn(),
            savePreferences: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            highlightPostInChannelPopout: jest.fn(),
        },
        isChannelAutotranslated: false,
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
            renderWithContext(<PostComponent {...baseProps}/>, baseState);

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
            const {rerender} = renderWithContext(<PostComponent {...props}/>, state);

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
            const {rerender} = renderWithContext(<PostComponent {...props}/>, baseState);

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
            const {rerender} = renderWithContext(<PostComponent {...props}/>);

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
            const {rerender} = renderWithContext(<PostComponent {...props}/>, state);

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
            const {rerender} = renderWithContext(<PostComponent {...props}/>);

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
            const {rerender} = renderWithContext(<PostComponent {...props}/>, state);

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

            test('should select post in RHS when clicked in center channel', async () => {
                renderWithContext(<PostComponent {...propsForRootPost}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                // Yes, this action has a different name than the one you'd expect
                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
            });

            test('should select post in RHS when clicked in center channel in a DM/GM', async () => {
                const props = {
                    ...propsForRootPost,
                    team: undefined,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                // Yes, this action has a different name than the one you'd expect
                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().push).not.toHaveBeenCalled();
            });

            test('should select post in RHS when clicked in a search result on the current team', async () => {
                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().push).not.toHaveBeenCalled();
            });

            test('should jump to post when clicked in a search result on another team', async () => {
                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                    team: TestHelper.getTeamMock({id: 'another_team'}),
                };
                renderWithContext(<PostComponent {...props}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).not.toHaveBeenCalled();
                expect(getHistory().push).toHaveBeenCalled();
            });

            test('should navigate within popout when clicking reply on a search result in a popout window', async () => {
                jest.spyOn(PopoutWindows, 'isPopoutWindow').mockReturnValue(true);

                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                    matches: ['test'],
                    teamName: currentTeam.name,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).not.toHaveBeenCalled();
                expect(getHistory().replace).toHaveBeenCalledWith(
                    expect.stringContaining(`/_popout/thread/${currentTeam.name}/${rootPost.id}`),
                );

                jest.restoreAllMocks();
            });

            test('should navigate within popout on cross-team reply click instead of jumping', async () => {
                jest.spyOn(PopoutWindows, 'isPopoutWindow').mockReturnValue(true);

                const props = {
                    ...propsForRootPost,
                    location: Locations.SEARCH,
                    matches: ['test'],
                    team: TestHelper.getTeamMock({id: 'another_team'}),
                    teamName: currentTeam.name,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                expect(getHistory().push).not.toHaveBeenCalled();
                expect(getHistory().replace).toHaveBeenCalledWith(
                    expect.stringContaining('/_popout/thread/'),
                );

                jest.restoreAllMocks();
            });

            test('should not navigate within popout when not a search result item', async () => {
                jest.spyOn(PopoutWindows, 'isPopoutWindow').mockReturnValue(true);

                const props = {
                    ...propsForRootPost,
                    location: Locations.CENTER,
                };
                renderWithContext(<PostComponent {...props}/>, state);

                await userEvent.click(screen.getByText('1 reply'));

                expect(propsForRootPost.actions.selectPostFromRightHandSideSearch).toHaveBeenCalledWith(rootPost);
                expect(getHistory().replace).not.toHaveBeenCalled();

                jest.restoreAllMocks();
            });
        });
    });

    describe('file list', () => {
        test('should show file list in post', () => {
            const fileInfo1 = TestHelper.getFileInfoMock({id: 'fileId1', name: 'file1.jpg', delete_at: 0});
            const fileInfo2 = TestHelper.getFileInfoMock({id: 'fileId2', name: 'file2.jpg', delete_at: 0});
            const fileInfo3 = TestHelper.getFileInfoMock({id: 'fileId3', name: 'file3.jpg', delete_at: 0});

            const post = TestHelper.getPostMock({file_ids: [fileInfo1.id, fileInfo2.id, fileInfo3.id]});

            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [post.id]: post,
                        },
                    },
                    files: {
                        files: {
                            [fileInfo1.id]: fileInfo1,
                            [fileInfo2.id]: fileInfo2,
                            [fileInfo3.id]: fileInfo3,
                        },
                        fileIdsByPostId: {
                            [baseProps.post.id]: ['fileId1', 'fileId2', 'fileId3'],
                        },
                    },
                },
            };

            const props = {
                ...baseProps,
                post,
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, state);
            expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
            const tiles = container.querySelectorAll('[data-testid="media-gallery-tile"]');
            expect(tiles).toHaveLength(3);
            expect(tiles[0]?.getAttribute('data-file-name')).toBe(fileInfo1.name);
            expect(tiles[1]?.getAttribute('data-file-name')).toBe(fileInfo2.name);
            expect(tiles[2]?.getAttribute('data-file-name')).toBe(fileInfo3.name);
        });

        test('should show file list in edit container when editing', async () => {
            const fileInfo1 = TestHelper.getFileInfoMock({id: 'fileId1', name: 'file1.jpg'});
            const fileInfo2 = TestHelper.getFileInfoMock({id: 'fileId2', name: 'file2.jpg'});
            const fileInfo3 = TestHelper.getFileInfoMock({id: 'fileId3', name: 'file3.jpg'});

            const team = TestHelper.getTeamMock({id: 'team_id'});
            const channel = TestHelper.getChannelMock({team_id: team.id});

            const post = TestHelper.getPostMock({
                file_ids: [fileInfo1.id, fileInfo2.id, fileInfo3.id],
                channel_id: channel.id,
                metadata: {
                    files: [fileInfo1, fileInfo2, fileInfo3],
                },
            });

            const state: DeepPartial<GlobalState> = {
                entities: {
                    posts: {
                        posts: {
                            [post.id]: post,
                        },
                    },
                    files: {
                        files: {
                            [fileInfo1.id]: fileInfo1,
                            [fileInfo2.id]: fileInfo2,
                            [fileInfo3.id]: fileInfo3,
                        },
                        fileIdsByPostId: {
                            [post.id]: [fileInfo1.id, fileInfo2.id, fileInfo3.id],
                        },
                    },
                    channels: {
                        channels: {
                            [channel.id]: channel,
                        },
                        roles: {
                            [channel.id]: new Set(['channel_member']),
                        },
                    },
                    teams: {
                        teams: {
                            [team.id]: team,
                        },
                    },
                    roles: {
                        roles: {
                            channel_member: {permissions: ['create_post']},
                        },
                    },
                },
                views: {
                    posts: {
                        editingPost: {
                            postId: post.id,
                            show: true,
                        },
                    },
                },
                storage: {
                    storage: {
                        edit_draft_id: {
                            value: {
                                ...post,
                            },
                        },
                    },
                },
            };

            const props = {
                ...baseProps,
                post,
                isPostBeingEdited: true,
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, state);

            // advanced text editor should be visible
            expect(container.querySelector('.AdvancedTextEditor__body')).toBeInTheDocument();

            // file attachment list should be visible inside advanced text editor
            expect(container.querySelector('.AdvancedTextEditor__body .file-preview__container')).toBeInTheDocument();
            expect(container.querySelectorAll('.post-image__column')).toHaveLength(3);
            expect(container.querySelectorAll('.post-image__column')[0]).toHaveTextContent(fileInfo1.name);
            expect(container.querySelectorAll('.post-image__column')[1]).toHaveTextContent(fileInfo2.name);
            expect(container.querySelectorAll('.post-image__column')[2]).toHaveTextContent(fileInfo3.name);

            // additionally, files should not be visible outside the advanced text editor
            expect(screen.queryByTestId('fileAttachmentList')).not.toBeInTheDocument();
        });
    });

    describe('priority labels', () => {
        test('should show priority label for non-deleted post with priority metadata', () => {
            const post = TestHelper.getPostMock({
                metadata: {
                    priority: {
                        priority: PostPriority.URGENT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByTestId('post-priority-label')).toBeInTheDocument();
        });

        test('should show priority label for non-deleted post with important priority metadata', () => {
            const post = TestHelper.getPostMock({
                metadata: {
                    priority: {
                        priority: PostPriority.IMPORTANT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByTestId('post-priority-label')).toBeInTheDocument();
        });

        test('should not show priority label for deleted post with priority metadata', () => {
            const post = TestHelper.getPostMock({
                state: Posts.POST_DELETED as 'DELETED',
                metadata: {
                    priority: {
                        priority: PostPriority.URGENT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByTestId('post-priority-label')).not.toBeInTheDocument();
        });

        test('should not show priority label for deleted post with important priority metadata', () => {
            const post = TestHelper.getPostMock({
                state: Posts.POST_DELETED as 'DELETED',
                metadata: {
                    priority: {
                        priority: PostPriority.IMPORTANT,
                    },
                },
            });
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByTestId('post-priority-label')).not.toBeInTheDocument();
        });

        test('should not show priority label for post without priority metadata', () => {
            const post = TestHelper.getPostMock();
            const props = {
                ...baseProps,
                post,
                isPostPriorityEnabled: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByTestId('post-priority-label')).not.toBeInTheDocument();
        });
    });

    describe('AI-generated indicator', () => {
        const aiGeneratedPost = TestHelper.getPostMock({
            channel_id: channel.id,
            props: {
                ai_generated_by: 'ai_user_id',
                ai_generated_by_username: 'aibot',
            },
        });

        test('should show AI-generated indicator for AI posts in non-compact mode', () => {
            const props = {
                ...baseProps,
                post: aiGeneratedPost,
                compactDisplay: false,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByLabelText('Message posted by @aibot')).toBeInTheDocument();
        });

        test('should not show AI-generated indicator for regular posts', () => {
            const regularPost = TestHelper.getPostMock({
                channel_id: channel.id,
            });
            const props = {
                ...baseProps,
                post: regularPost,
                compactDisplay: false,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.queryByLabelText(/AI-generated|Message posted by/)).not.toBeInTheDocument();
        });

        test('should show AI-generated indicator for consecutive AI posts', () => {
            const props = {
                ...baseProps,
                post: aiGeneratedPost,
                compactDisplay: false,
                isConsecutivePost: true,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByLabelText('Message posted by @aibot')).toBeInTheDocument();
        });

        test('should show AI-generated indicator in PostUserProfile for compact mode in CENTER', () => {
            const props = {
                ...baseProps,
                post: aiGeneratedPost,
                compactDisplay: true,
                location: Locations.CENTER,
            };
            renderWithContext(<PostComponent {...props}/>);

            // In compact CENTER mode, indicator is rendered by PostUserProfile (after username)
            // Verify it appears exactly once
            const indicators = screen.queryAllByLabelText(/AI-generated|Message posted by/);
            expect(indicators.length).toBe(1);
        });

        test('should show AI-generated indicator for consecutive AI posts in threads', () => {
            const threadPost = TestHelper.getPostMock({
                channel_id: channel.id,
                root_id: 'root_post_id',
                props: {
                    ai_generated_by: 'ai_user_id',
                    ai_generated_by_username: 'aibot',
                },
            });
            const props = {
                ...baseProps,
                post: threadPost,
                compactDisplay: false,
                isConsecutivePost: true,
                location: Locations.RHS_COMMENT,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByLabelText('Message posted by @aibot')).toBeInTheDocument();
        });

        test('should show AI-generated indicator for non-consecutive posts in threads', () => {
            const threadPost = TestHelper.getPostMock({
                channel_id: channel.id,
                root_id: 'root_post_id',
                props: {
                    ai_generated_by: 'ai_user_id',
                    ai_generated_by_username: 'aibot',
                },
            });
            const props = {
                ...baseProps,
                post: threadPost,
                compactDisplay: false,
                isConsecutivePost: false,
                location: Locations.RHS_COMMENT,
            };
            renderWithContext(<PostComponent {...props}/>);

            expect(screen.getByLabelText('Message posted by @aibot')).toBeInTheDocument();
        });
    });

    describe('post timestamp visibility', () => {
        const dateAndTimeState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {
                        DateTimeDisplayFormat: TimestampFormat.DATE_AND_TIME,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        };

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should hide consecutive post timestamp until hover', async () => {
            const user = userEvent.setup();
            const props = {
                ...baseProps,
                compactDisplay: true,
                isConsecutivePost: true,
                hasReplies: false,
                previousPostIsComment: false,
                location: Locations.CENTER,
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, dateAndTimeState);

            expect(container.querySelector('.post__time')).not.toBeInTheDocument();

            await user.hover(container.querySelector('.post')!);

            expect(container.querySelector('.post__time')).toBeInTheDocument();
        });

        test('should show timestamp on non-consecutive posts', () => {
            const props = {
                ...baseProps,
                compactDisplay: true,
                isConsecutivePost: false,
                location: Locations.CENTER,
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, dateAndTimeState);

            expect(container.querySelector('.post__time')).toBeInTheDocument();
        });

        test('should show date context for compact posts in RHS thread', () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

            const props = {
                ...baseProps,
                compactDisplay: true,
                isConsecutivePost: false,
                location: Locations.RHS_COMMENT,
                post: TestHelper.getPostMock({
                    channel_id: channel.id,
                    create_at: new Date('2020-06-01T16:32:00.000Z').getTime(),
                    root_id: 'root_post_id',
                }),
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, dateAndTimeState);

            expect(screen.getByText('Jun 1, 4:32 PM')).toBeInTheDocument();
            expect(container.querySelector('.post__header--wrap-time')).toBeInTheDocument();
            expect(container.querySelector('.post__header-timestamp')).toBeInTheDocument();
        });

        test('should show date context for consecutive compact posts in RHS thread', () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2020-06-15T12:00:00.000Z'));

            const props = {
                ...baseProps,
                compactDisplay: true,
                isConsecutivePost: true,
                location: Locations.RHS_COMMENT,
                post: TestHelper.getPostMock({
                    channel_id: channel.id,
                    create_at: new Date('2020-06-01T16:32:00.000Z').getTime(),
                    root_id: 'root_post_id',
                }),
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, dateAndTimeState);

            expect(screen.getByText('Jun 1, 4:32 PM')).toBeInTheDocument();
            expect(container.querySelector('.post__header--wrap-time')).toBeInTheDocument();
        });

        test('should not stack timestamp for standard format', () => {
            const standardState: DeepPartial<GlobalState> = {
                entities: {
                    general: {
                        config: {
                            DateTimeDisplayFormat: TimestampFormat.STANDARD,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            };

            const props = {
                ...baseProps,
                compactDisplay: false,
                isConsecutivePost: false,
                location: Locations.CENTER,
                post: TestHelper.getPostMock({
                    channel_id: channel.id,
                    create_at: new Date('2020-06-01T16:32:00.000Z').getTime(),
                }),
            };

            const {container} = renderWithContext(<PostComponent {...props}/>, standardState);

            expect(container.querySelector('.post__header--wrap-time')).not.toBeInTheDocument();
        });
    });

    describe('plugin channel icon override', () => {
        const mockedCompassIconForName = jest.mocked(compassIconForName);

        afterEach(() => {
            mockedCompassIconForName.mockReset();
        });

        test('renders override SVG icon for archived channel in search view when plugin matches', () => {
            const StubIcon = ({size, color, className}: {size?: number; color?: string; className?: string}) => (
                <span
                    data-testid='stub-override-icon'
                    data-size={size}
                    data-color={color}
                    className={className}
                />
            );
            mockedCompassIconForName.mockReturnValue(StubIcon as any);

            const props = {
                ...baseProps,
                channelIsArchived: true,
                channelType: 'O' as any,
                channel,
                location: Locations.SEARCH,
                isMentionSearch: true,
            };

            const state = {
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => true,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(<PostComponent {...props}/>, state);
            const overrideIcon = screen.getByTestId('stub-override-icon');
            expect(overrideIcon).toBeInTheDocument();

            // Override icon gets svg-text-color (greyed to signal archived) but not the built-in archive icon classes
            expect(overrideIcon).toHaveClass('svg-text-color');
            expect(overrideIcon).not.toHaveClass('channel-header-archived-icon');

            // No "Archived" tooltip when override wins (parent is aria-hidden; tooltip adds no a11y value)
            expect(screen.queryByText('Archived')).not.toBeInTheDocument();

            // Default archive icon is absent when override wins
            expect(document.querySelector('[data-is-default-archive]')).not.toBeInTheDocument();
        });

        test('renders default SVG archive icon when no plugin matcher matches', () => {
            mockedCompassIconForName.mockReturnValue(null);

            const props = {
                ...baseProps,
                channelIsArchived: true,
                channelType: 'O' as any,
                channel,
                location: Locations.SEARCH,
                isMentionSearch: true,
            };

            const state = {
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => false,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            const {container} = renderWithContext(<PostComponent {...props}/>, state);
            expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
            expect(container.querySelector('.search-channel__archived')).toBeInTheDocument();

            // Default archive icon is present in the fallback path
            expect(document.querySelector('[data-is-default-archive]')).toBeInTheDocument();
        });
    });
});

describe('PostComponent — PostHeader plugin component render site', () => {
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
        permissionPoliciesEnabled: false,
        location: Locations.CENTER,
        post: TestHelper.getPostMock({channel_id: channel.id}),
        recentEmojis: [],
        replyCount: 0,
        team: currentTeam,
        pluginActions: [],
        burnOnReadDurationMinutes: 10,
        actions: {
            markPostAsUnread: jest.fn(),
            emitShortcutReactToLastPostFrom: jest.fn(),
            selectPost: jest.fn(),
            selectPostFromRightHandSideSearch: jest.fn(),
            removePost: jest.fn(),
            closeRightHandSide: jest.fn(),
            selectPostCard: jest.fn(),
            setRhsExpanded: jest.fn(),
            revealBurnOnReadPost: jest.fn(),
            savePreferences: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            highlightPostInChannelPopout: jest.fn(),
        },
        isChannelAutotranslated: false,
    };

    // A real plugin-registered component rendered through Pluggable — not mocked away, so the
    // test exercises the same Pluggable path the host uses in production.
    const PluginBadge = () => <div data-testid='post-header-plugin'/>;

    function stateWithPluginBadge() {
        return {
            plugins: {
                components: {
                    PostHeader: [{
                        id: 'badge-1',
                        pluginId: 'test-plugin',
                        component: PluginBadge,
                    }],
                },
            },
        } as any;
    }

    it('renders a registered PostHeader component in the badges area', () => {
        renderWithContext(<PostComponent {...baseProps}/>, stateWithPluginBadge());
        expect(screen.getByTestId('post-header-plugin')).toBeInTheDocument();
    });

    it('does not render the component on a consecutive CENTER post (timestamp is hidden)', () => {
        renderWithContext(
            <PostComponent
                {...baseProps}
                isConsecutivePost={true}
            />,
            stateWithPluginBadge(),
        );
        expect(screen.queryByTestId('post-header-plugin')).not.toBeInTheDocument();
    });

    it('does not render the component on a consecutive RHS_COMMENT post (timestamp is reflowed to narrow style)', () => {
        renderWithContext(
            <PostComponent
                {...baseProps}
                isConsecutivePost={true}
                location={Locations.RHS_COMMENT}
            />,
            stateWithPluginBadge(),
        );
        expect(screen.queryByTestId('post-header-plugin')).not.toBeInTheDocument();
    });

    it('renders the component on a consecutive RHS_COMMENT post in compactDisplay mode (timestamp stays in badges area)', () => {
        renderWithContext(
            <PostComponent
                {...baseProps}
                isConsecutivePost={true}
                location={Locations.RHS_COMMENT}
                compactDisplay={true}
            />,
            stateWithPluginBadge(),
        );
        expect(screen.getByTestId('post-header-plugin')).toBeInTheDocument();
    });
});
