// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Reaction as ReactionType} from '@mattermost/types/reactions';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import Reaction from './reaction';

describe('components/post_view/Reaction', () => {
    const post = TestHelper.getPostMock({
        id: 'post_id',
    });
    const reactions: ReactionType[] = [{
        user_id: 'user_id_2',
        post_id: post.id,
        emoji_name: ':smile:',
        create_at: 0,
    }, {
        user_id: 'user_id_3',
        post_id: post.id,
        emoji_name: ':smile:',
        create_at: 0,
    }];
    const emojiName = 'smile';
    const actions = {
        addReaction: vi.fn(),
        getMissingProfilesByIds: vi.fn(),
        removeReaction: vi.fn(),
    };

    const baseProps = {
        canAddReactions: true,
        canRemoveReactions: true,
        post,
        currentUserReacted: false,
        emojiName,
        reactionCount: 2,
        reactions,
        emojiImageUrl: 'emoji_image_url',
        actions,
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'user_id_1',
                profiles: {
                    user_id_2: TestHelper.getUserMock({id: 'user_id_2', username: 'user2'}),
                    user_id_3: TestHelper.getUserMock({id: 'user_id_3', username: 'user3'}),
                },
            },
            emojis: {customEmoji: {}},
            preferences: {myPreferences: {}},
        },
    } as any;

    test('should match snapshot', () => {
        const {container} = renderWithContext(<Reaction {...baseProps}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when a current user reacted to a post', () => {
        const newReactions = [{
            user_id: 'user_id_1',
            post_id: post.id,
            emoji_name: ':cry:',
            create_at: 0,
        }, {
            user_id: 'user_id_3',
            post_id: post.id,
            emoji_name: ':smile:',
            create_at: 0,
        }];
        const props = {
            ...baseProps,
            currentUserReacted: true,
            reactions: newReactions,
        };
        const {container} = renderWithContext(<Reaction {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should return null/empty if no emojiImageUrl', () => {
        const props = {...baseProps, emojiImageUrl: ''};
        const {container} = renderWithContext(<Reaction {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should apply read-only class if user does not have permission to add reaction', () => {
        const props = {...baseProps, canAddReactions: false};
        const {container} = renderWithContext(<Reaction {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should apply read-only class if user does not have permission to remove reaction', () => {
        const props = {
            ...baseProps,
            canRemoveReactions: false,
            currentUserReacted: true,
        };
        const {container} = renderWithContext(<Reaction {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should have called actions.getMissingProfilesByIds when loadMissingProfiles is called', async () => {
        renderWithContext(<Reaction {...baseProps}/>, initialState);

        // The component loads missing profiles when the reaction button is hovered (triggers loadMissingProfiles internally)
        const reactionButton = screen.getByRole('button');
        expect(reactionButton).toBeInTheDocument();

        // Trigger hover to show tooltip and load profiles
        await userEvent.hover(reactionButton);

        // The getMissingProfilesByIds should be called with the user IDs from reactions
        await waitFor(() => {
            expect(actions.getMissingProfilesByIds).toHaveBeenCalledWith([reactions[0].user_id, reactions[1].user_id]);
        });
    });
});
