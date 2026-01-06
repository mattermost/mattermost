// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostReaction from './post_reaction';

describe('components/post_view/PostReaction', () => {
    const baseProps = {
        channelId: 'current_channel_id',
        postId: 'post_id_1',
        teamId: 'current_team_id',
        getDotMenuRef: jest.fn(),
        showIcon: false,
        showEmojiPicker: false,
        setShowEmojiPicker: jest.fn(),
        actions: {
            toggleReaction: jest.fn(),
        },
    };

    const userId = 'userId';
    const initialState = {
        entities: {
            roles: {
                roles: {
                    system_user: TestHelper.getRoleMock({permissions: [Permissions.ADD_REACTION]}),
                },
            },
            users: {
                currentUserId: userId,
                profiles: {
                    userId: TestHelper.getUserMock({id: userId, roles: 'system_user'}),
                },
            },
        },
    };

    test('should not render the emoji picker initially', async () => {
        const {rerender} = renderWithContext(
            <PostReaction {...baseProps}/>,
            initialState,
        );

        expect(screen.queryByPlaceholderText('Search emojis')).not.toBeInTheDocument();

        await Promise.resolve();

        rerender(
            <PostReaction
                {...baseProps}
                showEmojiPicker={true}
            />,
        );

        expect(screen.queryByPlaceholderText('Search emojis')).toBeInTheDocument();
    });

    test('should toggle the reaction and close the emoji picker when an emoji is selected', async () => {
        renderWithContext(
            <PostReaction
                {...baseProps}
                showEmojiPicker={true}
            />,
            initialState,
        );

        await userEvent.type(screen.getByPlaceholderText('Search emojis'), '{enter}');

        expect(baseProps.actions.toggleReaction).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.toggleReaction).toHaveBeenCalledWith('post_id_1', 'grinning');
        expect(baseProps.setShowEmojiPicker).toHaveBeenCalledWith(false);
    });
});
