// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import DotMenu from 'components/dot_menu/dot_menu';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

vi.mock('utils/utils', () => {
    return {
        localizeMessage: vi.fn().mockReturnValue(''),
    };
});

vi.mock('utils/post_utils', async () => {
    const original = await vi.importActual('utils/post_utils');
    return {
        ...original,
        isSystemMessage: vi.fn(() => true),
    };
});

describe('components/dot_menu/DotMenu returning empty ("")', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                myMembers: {},
                channels: {},
                messageCounts: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                profiles: {},
                currentUserId: 'current_user_id',
                profilesInChannel: {},
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
            },
            posts: {
                posts: {},
                postsInChannel: {},
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

    test('should match snapshot, return empty ("") on Center', () => {
        const baseProps = {
            post: TestHelper.getPostMock({id: 'post_id_1'}),
            isLicensed: false,
            postEditTimeLimit: '-1',
            handleCommentClick: vi.fn(),
            handleDropdownOpened: vi.fn(),
            enableEmojiPicker: true,
            components: {},
            channelIsArchived: false,
            currentTeamUrl: '',
            actions: {
                flagPost: vi.fn(),
                unflagPost: vi.fn(),
                setEditingPost: vi.fn(),
                pinPost: vi.fn(),
                unpinPost: vi.fn(),
                openModal: vi.fn(),
                markPostAsUnread: vi.fn(),
                handleBindingClick: vi.fn(),
                postEphemeralCallResponseForPost: vi.fn(),
                setThreadFollow: vi.fn(),
                addPostReminder: vi.fn(),
                setGlobalItem: vi.fn(),
            },
            canEdit: false,
            canDelete: false,
            appBindings: [],
            pluginMenuItems: [],
            appsEnabled: false,
            isMobileView: false,
            isReadOnly: false,
            isCollapsedThreadsEnabled: false,
            teamId: '',
            threadId: 'post_id_1',
            userId: 'user_id_1',
            isMilitaryTime: false,
            canMove: true,
            isBurnOnReadPost: false,
        };

        renderWithContext(
            <DotMenu {...baseProps}/>,
            initialState,
        );

        const button = screen.getByTestId(`PostDotMenu-Button-${baseProps.post.id}`);
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-label', 'more');
    });
});
