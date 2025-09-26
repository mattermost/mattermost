// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AddReactionButton from './add_reaction_button';

describe('AddReactionButton', () => {
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

    test('should show emoji picker when clicked and then close it when an emoji is selected', async () => {
        const props = {
            post: TestHelper.getPostMock({user_id: userId, channel_id: 'channelId'}),
            teamId: 'teamId',
            onEmojiClick: jest.fn(),
        };

        renderWithContext(
            <AddReactionButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText('Emoji Picker')).not.toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Add a reaction'));

        expect(screen.queryByText('Emoji Picker')).toBeVisible();

        // Search for an emoji instead of clicking on one because the emoji picker doesn't render items when testing
        await userEvent.type(screen.getByPlaceholderText('Search emojis'), 'banana{enter}');

        expect(props.onEmojiClick).toHaveBeenCalledWith(expect.objectContaining({short_name: 'banana'}));
        expect(screen.queryByText('Emoji Picker')).not.toBeInTheDocument();
    });
});
