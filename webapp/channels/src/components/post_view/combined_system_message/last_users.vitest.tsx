// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Posts} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import LastUsers from './last_users';

describe('components/post_view/combined_system_message/LastUsers', () => {
    const formatOptions = {
        atMentions: true,
        mentionKeys: [{key: '@username2'}, {key: '@username3'}, {key: '@username4'}],
        mentionHighlight: false,
    };
    const baseProps = {
        actor: 'user_1',
        expandedLocale: {
            id: 'combined_system_message.added_to_channel.many_expanded',
            defaultMessage: '{users} and {lastUser} **added to the channel** by {actor}.',
        },
        formatOptions,
        postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
        usernames: ['@username2', '@username3', '@username4 '],
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    user_1: TestHelper.getUserMock({}),
                },
            },
            groups: {groups: {}, myGroups: []},
            emojis: {customEmoji: {}},
            channels: {},
            teams: {
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as any;

    test('should match component state', async () => {
        renderWithContext(
            <LastUsers {...baseProps}/>, initialState,
        );

        expect(screen.getByText(getMentionKeyAt(0))).toBeInTheDocument();
        expect(screen.getByText(getMentionKeyAt(0))).toHaveAttribute('data-mention', 'username2');

        expect(screen.getByText('and')).toBeInTheDocument();

        //there are 3 mention keys, so the text should read
        await userEvent.click(screen.getByText(`${formatOptions.mentionKeys.length - 1} others`));

        expect(screen.getByText('added to the channel')).toBeInTheDocument();
        expect(screen.getByText(`by ${baseProps.actor}`, {exact: false})).toBeInTheDocument();
    });

    test('should match component state, expanded', async () => {
        renderWithContext(
            <LastUsers {...baseProps}/>, initialState,
        );

        //first key should be visible
        expect(screen.getByText(getMentionKeyAt(0))).toBeInTheDocument();
        expect(screen.getByText(getMentionKeyAt(0))).toHaveAttribute('data-mention', 'username2');

        //other keys should be hidden
        expect(screen.queryByText(getMentionKeyAt(1))).not.toBeInTheDocument();
        expect(screen.queryByText(getMentionKeyAt(2))).not.toBeInTheDocument();

        // The "X others" link should be visible before clicking
        const othersLink = screen.getByText(`${formatOptions.mentionKeys.length - 1} others`);
        expect(othersLink).toBeInTheDocument();

        //setting {expand: true} in the state
        await userEvent.click(othersLink);

        // After expanding, the "X others" link should no longer be visible
        expect(screen.queryByText(`${formatOptions.mentionKeys.length - 1} others`)).not.toBeInTheDocument();

        //hidden keys should be visible
        expect(screen.getByText(getMentionKeyAt(1))).toBeInTheDocument();
        expect(screen.getByText(getMentionKeyAt(1))).toHaveAttribute('data-mention', 'username3');

        expect(screen.getByText(getMentionKeyAt(2))).toBeInTheDocument();
        expect(screen.getByText(getMentionKeyAt(2))).toHaveAttribute('data-mention', 'username4');

        expect(screen.getByText('added to the channel')).toBeInTheDocument();
        expect(screen.getByText(`by ${baseProps.actor}`, {exact: false})).toBeInTheDocument();
    });

    function getMentionKeyAt(index: number) {
        return baseProps.formatOptions.mentionKeys[index].key;
    }
});
