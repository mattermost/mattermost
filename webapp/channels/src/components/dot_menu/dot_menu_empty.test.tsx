// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import DotMenu from 'components/dot_menu/dot_menu';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

jest.mock('utils/utils', () => {
    return {
        localizeMessage: jest.fn().mockReturnValue(''),
    };
});

jest.mock('utils/post_utils', () => {
    const original = jest.requireActual('utils/post_utils');
    return {
        ...original,
        isSystemMessage: jest.fn(() => true),
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
                markPostAsUnread: jest.fn(),
                handleBindingClick: jest.fn(),
                postEphemeralCallResponseForPost: jest.fn(),
                setThreadFollow: jest.fn(),
                addPostReminder: jest.fn(),
                setGlobalItem: jest.fn(),
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
