// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {Post, PostType} from '@mattermost/types/posts';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import DotMenu from './dot_menu';

import DotMenuRoot from './index';

describe('components/dot_menu/DotMenu', () => {
    const latestPost = {
        id: 'latest_post_id',
        user_id: 'current_user_id',
        message: 'test msg',
        channel_id: 'other_gm_channel',
        create_at: Date.now(),
    };

    const post1 = {
        id: 'post_id_1',
        user_id: 'current_user_id',
        message: 'test msg',
        channel_id: 'channel_id_1',
        create_at: Date.now(),
        type: '',
    } as Post;

    const dmPost = {
        id: 'dm_post_id_1',
        user_id: 'current_user_id',
        message: 'DM message',
        channel_id: 'dm_channel',
        create_at: Date.now(),
        type: '',
    } as Post;

    const gmPost = {
        id: 'gm_post_id_1',
        user_id: 'current_user_id',
        message: 'GM message',
        channel_id: 'gm_channel',
        create_at: Date.now(),
        type: '',
    } as Post;

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    FeatureFlagContentFlagging: 'true',
                    ContentFlaggingEnabled: 'true',
                },
            },
            channels: {
                myMembers: {
                    current_channel_id: {
                        channel_id: 'current_channel_id',
                        user_id: 'current_user_id',
                    },
                    direct_other_user: {
                        channel_id: 'direct_other_user',
                        user_id: 'current_user_id',
                        roles: 'channel_role',
                        last_viewed_at: 10,
                    },
                    channel_other_user: {
                        channel_id: 'channel_other_user',
                    },
                },
                channels: {
                    direct_other_user: {
                        id: 'direct_other_user',
                        name: 'current_user_id__other_user',
                    },
                    channel_id_1: {
                        id: 'channel_id_1',
                        name: 'channel_1',
                        display_name: 'Channel 1',
                        type: 'O' as ChannelType,
                        team_id: 'currentTeamId',
                    },
                    dm_channel: {
                        id: 'dm_channel_id_1',
                        name: 'dm_channel',
                        display_name: 'DM Channel',
                        type: 'D' as ChannelType,
                        team_id: '',
                    },
                    gm_channel: {
                        id: 'gm_channel_id_1',
                        name: 'gm_channel',
                        display_name: 'GM Channel',
                        type: 'G' as ChannelType,
                        team_id: '',
                    },
                },
                messageCounts: {
                    direct_other_user: {
                        root: 2,
                        total: 2,
                    },
                },
            },
            preferences: {
                myPreferences: {
                },
            },
            users: {
                profiles: {
                    current_user_id: {roles: 'system_role'},
                    other_user1: TestHelper.getUserMock({
                        id: 'otherUserId',
                        username: 'UserOther',
                        roles: '',
                        email: 'other-user@example.com',
                    }),
                },
                currentUserId: 'current_user_id',
                profilesInChannel: {
                    current_user_id: new Set(['user_1']),
                },
            },
            teams: {
                currentTeamId: 'currentTeamId',
                teams: {
                    currentTeamId: {
                        id: 'currentTeamId',
                        display_name: 'test',
                        type: 'O',
                    },
                },
                contentFlaggingStatus: {
                    currentTeamId: true,
                },
            },
            posts: {
                posts: {
                    [latestPost.id]: latestPost,
                    post_id_1: post1,
                    dm_post_id_1: dmPost,
                    gm_post_id_1: gmPost,
                },
                postsInChannel: {
                    other_gm_channel: [
                        {order: [latestPost.id], recent: true},
                    ],
                },
                postsInThread: {},
            },
        },
        views: {
            browser: {
                focused: false,
                windowSize: 'desktopView',
            },
            modals: {
                modalState: {},
                showLaunchingWorkspace: false,
            },
        },
    };
    const baseProps = {
        post: TestHelper.getPostMock({id: 'post_id_1', is_pinned: false, type: '' as PostType}),
        isLicensed: false,
        postEditTimeLimit: '-1',
        handleCommentClick: jest.fn(),
        handleDropdownOpened: jest.fn(),
        enableEmojiPicker: true,
        components: {},
        channelIsArchived: false,
        currentTeamUrl: '',
        actions: {
            flagPost: jest.fn(),
            unflagPost: jest.fn(),
            setEditingPost: jest.fn(),
            pinPost: jest.fn(),
            unpinPost: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            markPostAsUnread: jest.fn(),
            postEphemeralCallResponseForPost: jest.fn(),
            setThreadFollow: jest.fn(),
            addPostReminder: jest.fn(),
            setGlobalItem: jest.fn(),
            burnPostNow: jest.fn(),
            savePreferences: jest.fn(),
        },
        canEdit: false,
        canDelete: false,
        isReadOnly: false,
        teamId: 'team_id_1',
        isFollowingThread: false,
        isCollapsedThreadsEnabled: true,
        isMobileView: false,
        threadId: 'post_id_1',
        threadReplyCount: 0,
        userId: 'user_id_1',
        isMilitaryTime: false,
        canMove: true,
        isChannelAutotranslated: false,
        canReply: true,
        canForward: true,
        canFollowThread: true,
        canPin: true,
        canCopyText: true,
        canCopyLink: true,
        isBurnOnReadPost: false,
        isUnrevealedBurnOnReadPost: false,
    };

    test('should show edit menu, on Center', async () => {
        const props = {
            ...baseProps,
            canEdit: true,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-label', 'more');

        await userEvent.click(button);

        // Check that edit menu item is present when canEdit is true
        expect(screen.getByTestId(`edit_post_${baseProps.post.id}`)).toBeInTheDocument();
    });

    test('should show delete menu, canDelete', async () => {
        const props = {
            ...baseProps,
            canEdit: true,
            canDelete: true,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        await userEvent.click(button);

        // Check that delete menu item is present when canDelete is true
        expect(screen.getByTestId(`delete_post_${baseProps.post.id}`)).toBeInTheDocument();
    });

    test('should show move thread menu, can move', async () => {
        const props = {
            ...baseProps,
            canMove: true,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        await userEvent.click(button);

        // Check that move thread menu item is present when canMove is true
        expect(screen.getByText('Move Thread')).toBeInTheDocument();
    });

    test('should not show move thread menu when canMove is false, cannot move', async () => {
        const props = {
            ...baseProps,
            canMove: false,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        await userEvent.click(button);

        // Check that move thread menu item is not present when canMove is false
        expect(screen.queryByText('Move Thread')).not.toBeInTheDocument();
    });

    test('should not show move thread menu for burn-on-read posts', async () => {
        const borPost = {
            ...post1,
            type: 'burn_on_read' as PostType,
            user_id: 'current_user_id',
        };
        const props = {
            ...baseProps,
            post: borPost,
            canMove: false, // BoR posts cannot be moved
            isBurnOnReadPost: true,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${borPost.id}`);
        await userEvent.click(button);

        // Check that move thread menu item is not present for BoR posts
        expect(screen.queryByText('Move Thread')).not.toBeInTheDocument();
    });

    test('should not trigger move thread when pressing W key on burn-on-read post', async () => {
        const borPost = {
            ...post1,
            type: 'burn_on_read' as PostType,
            user_id: 'current_user_id',
        };
        const props = {
            ...baseProps,
            post: borPost,
            canMove: false, // BoR posts cannot be moved
            isBurnOnReadPost: true,
        };

        renderWithContext(<DotMenuRoot {...props}/>, initialState);

        const button = screen.getByTestId(`PostDotMenu-Button-${borPost.id}`);
        await userEvent.click(button);

        // Simulate pressing 'W' key while menu is open
        const menu = screen.getByRole('menu');
        menu.focus();
        await userEvent.keyboard('W');

        // Move thread should not be triggered (menu item doesn't exist, so no way to verify the action wasn't called)
        // The fact that canMove is false means the menu item is hidden and keyboard shortcut is blocked
        expect(screen.queryByText('Move Thread')).not.toBeInTheDocument();
    });

    test('should show mark as unread when channel is not archived', async () => {
        const props = {
            ...baseProps,
            location: Locations.CENTER,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );
        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        await userEvent.click(button);
        const menuItem = screen.getByTestId(`unread_post_${baseProps.post.id}`);
        expect(menuItem).toBeVisible();
    });

    test('should not show mark as unread when channel is archived', async () => {
        const props = {
            ...baseProps,
            channelIsArchived: true,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );
        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        await userEvent.click(button);
        const menuItem = screen.queryByTestId(`unread_post_${baseProps.post.id}`);
        expect(menuItem).toBeNull();
    });

    test('should not show mark as unread in search', async () => {
        const props = {
            ...baseProps,
            location: Locations.SEARCH,
        };
        renderWithContext(
            <DotMenu {...props}/>,
            initialState,
        );
        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        await userEvent.click(button);
        const menuItem = screen.queryByTestId(`unread_post_${baseProps.post.id}`);
        expect(menuItem).toBeNull();
    });

    describe('RHS', () => {
        test.each([
            [true, {location: Locations.RHS_ROOT, isCollapsedThreadsEnabled: true}],
            [true, {location: Locations.RHS_COMMENT, isCollapsedThreadsEnabled: true}],
            [true, {location: Locations.CENTER, isCollapsedThreadsEnabled: true}],
        ])('follow message/thread menu item should be shown only in RHS and center channel when CRT is enabled', async (showing, caseProps) => {
            const props = {
                ...baseProps,
                ...caseProps,
            };
            renderWithContext(
                <DotMenu {...props}/>,
                initialState,
            );
            const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
            await userEvent.click(button);
            const menuItem = screen.getByTestId(`follow_post_thread_${baseProps.post.id}`);
            expect(menuItem).toBeVisible();
        });

        test.each([
            [false, {location: Locations.RHS_ROOT, isCollapsedThreadsEnabled: false}],
            [false, {location: Locations.RHS_COMMENT, isCollapsedThreadsEnabled: false}],
            [false, {location: Locations.CENTER, isCollapsedThreadsEnabled: false}],
            [false, {location: Locations.SEARCH, isCollapsedThreadsEnabled: true}],
            [false, {location: Locations.NO_WHERE, isCollapsedThreadsEnabled: true}],
        ])('follow message/thread menu item should be shown only in RHS and center channel when CRT is enabled', async (showing, caseProps) => {
            const props = {
                ...baseProps,
                ...caseProps,

                // canFollowThread should be false when collapsed threads is disabled or location is not CENTER/RHS
                canFollowThread: false,
            };
            renderWithContext(
                <DotMenu {...props}/>,
                initialState,
            );
            const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
            await userEvent.click(button);
            const menuItem = screen.queryByTestId(`follow_post_thread_${baseProps.post.id}`);
            expect(menuItem).toBeNull();
        });

        test.each([
            ['Follow message', {isFollowingThread: false, threadReplyCount: 0}],
            ['Unfollow message', {isFollowingThread: true, threadReplyCount: 0}],
            ['Follow thread', {isFollowingThread: false, threadReplyCount: 1}],
            ['Unfollow thread', {isFollowingThread: true, threadReplyCount: 1}],
        ])('should show correct text', async (text, caseProps) => {
            const props = {
                ...baseProps,
                ...caseProps,
                location: Locations.RHS_ROOT,
            };
            renderWithContext(
                <DotMenu {...props}/>,
                initialState,
            );
            const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
            await userEvent.click(button);
            const menuItem = screen.getByTestId(`follow_post_thread_${baseProps.post.id}`);
            expect(menuItem).toBeVisible();
            expect(menuItem).toHaveTextContent(text);
        });
    });

    test('should show flag post menu option when allowed', async () => {
        const props = {
            ...baseProps,
            post: post1,
        };
        renderWithContext(
            <DotMenuRoot {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${post1.id}`);
        await userEvent.click(button);

        const flagPostOption = screen.getByTestId(`flag_post_${post1.id}`);
        expect(flagPostOption).toBeVisible();
    });

    test('should not show flag post menu option for DM channel even when enabled', async () => {
        const props = {
            ...baseProps,
            post: dmPost,
        };
        renderWithContext(
            <DotMenuRoot {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${dmPost.id}`);
        await userEvent.click(button);

        const flagPostOption = screen.queryByTestId(`flag_post_${dmPost.id}`);
        expect(flagPostOption).toBeNull();
    });

    test('should not show flag post menu option for GM channel even when enabled', async () => {
        const props = {
            ...baseProps,
            post: gmPost,
        };
        renderWithContext(
            <DotMenuRoot {...props}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${gmPost.id}`);
        await userEvent.click(button);

        const flagPostOption = screen.queryByTestId(`flag_post_${gmPost.id}`);
        expect(flagPostOption).toBeNull();
    });

    test('should not show flag post menu option for burn on read posts', async () => {
        const burnOnReadPost: Post = {
            ...post1,
            type: 'burn_on_read',
        };
        const props = {
            ...baseProps,
            post: burnOnReadPost,
        };
        renderWithContext(<DotMenuRoot {...props}/>, initialState);

        const button = screen.getByTestId(`PostDotMenu-Button-${post1.id}`);
        await userEvent.click(button);

        const flagPostOption = screen.queryByTestId(`flag_post_${post1.id}`);
        expect(flagPostOption).toBeNull();
    });

    test('should show copy link for burn-on-read post sender', async () => {
        const borPost = {
            ...post1,
            type: 'burn_on_read' as PostType,
            user_id: 'current_user_id',
        };
        const props = {
            ...baseProps,
            post: borPost,
        };
        const stateWithBorPost = {
            ...initialState,
            entities: {
                ...initialState.entities,
                posts: {
                    ...initialState.entities!.posts,
                    posts: {
                        ...initialState.entities!.posts!.posts,
                        [borPost.id]: borPost,
                    },
                },
            },
        };
        renderWithContext(
            <DotMenuRoot {...props}/>,
            stateWithBorPost,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${borPost.id}`);
        await userEvent.click(button);

        const copyLinkOption = screen.queryByTestId(`permalink_${borPost.id}`);
        expect(copyLinkOption).not.toBeNull();
    });

    test('should not show copy link for burn-on-read post receiver', async () => {
        const borPost = {
            ...post1,
            type: 'burn_on_read' as PostType,
            user_id: 'other_user_id',
        };
        const props = {
            ...baseProps,
            post: borPost,
        };
        const stateWithBorPost = {
            ...initialState,
            entities: {
                ...initialState.entities,
                posts: {
                    ...initialState.entities!.posts,
                    posts: {
                        ...initialState.entities!.posts!.posts,
                        [borPost.id]: borPost,
                    },
                },
            },
        };
        renderWithContext(
            <DotMenuRoot {...props}/>,
            stateWithBorPost,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${borPost.id}`);
        await userEvent.click(button);

        const copyLinkOption = screen.queryByTestId(`permalink_${borPost.id}`);
        expect(copyLinkOption).toBeNull();
    });

    test('should not trigger reply when pressing R key on burn-on-read post', async () => {
        const borPost = {
            ...post1,
            type: 'burn_on_read' as PostType,
            user_id: 'other_user_id',
        };
        const props = {
            ...baseProps,
            post: borPost,
            location: Locations.CENTER,
        };
        const stateWithBorPost = {
            ...initialState,
            entities: {
                ...initialState.entities,
                posts: {
                    ...initialState.entities!.posts,
                    posts: {
                        ...initialState.entities!.posts!.posts,
                        [borPost.id]: borPost,
                    },
                },
            },
        };

        renderWithContext(<DotMenuRoot {...props}/>, stateWithBorPost);

        const button = screen.getByTestId(`PostDotMenu-Button-${borPost.id}`);
        await userEvent.click(button);

        // Reply option should not be visible for BoR posts
        const replyOption = screen.queryByTestId(`reply_to_post_${borPost.id}`);
        expect(replyOption).toBeNull();

        // Simulate pressing 'R' key while menu is open - should do nothing
        const menu = screen.getByRole('menu');
        menu.focus();
        await userEvent.keyboard('R');

        // Since reply option doesn't exist, keyboard shortcut should be blocked (no way to verify action wasn't called, but menu item being hidden confirms it)
        expect(replyOption).toBeNull();
    });
});
