// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {setSystemEmojis} from 'mattermost-redux/actions/emojis';
import {Client4} from 'mattermost-redux/client';
import {Permissions} from 'mattermost-redux/constants';
import {getReactionsForPosts} from 'mattermost-redux/selectors/entities/posts';

import PublishedPostReactions from 'components/post_view/reaction_list/published_post_reactions';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {EmojiIndicesByAlias} from 'utils/emoji';
import {TestHelper} from 'utils/test_helper';

import {publishedComponents} from './published_components';

describe('publishedComponents', () => {
    test('publishes core\'s WithTooltip', () => {
        expect(publishedComponents.WithTooltip).toBe(WithTooltip);
    });

    test('WithTooltip shows its title on hover', async () => {
        const {WithTooltip: PublishedWithTooltip} = publishedComponents;
        renderWithContext(
            <PublishedWithTooltip title='Tooltip title'>
                <button>{'Trigger'}</button>
            </PublishedWithTooltip>,
        );

        await userEvent.hover(screen.getByRole('button', {name: 'Trigger'}));

        expect(await screen.findByText('Tooltip title')).toBeInTheDocument();
    });

    describe('PostReactions', () => {
        const userId = 'user_id';
        const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});
        const post = TestHelper.getPostMock({id: 'post_id', channel_id: channel.id, user_id: userId});
        const reaction = {
            user_id: 'user_id_2',
            post_id: post.id,
            emoji_name: 'smile',
            create_at: 100,
        };

        const initialState = {
            entities: {
                general: {
                    config: {
                        EnableCustomEmoji: 'true',
                        EnableEmojiPicker: 'true',
                    },
                },
                channels: {
                    channels: {
                        [channel.id]: channel,
                    },
                },
                roles: {
                    roles: {
                        system_user: TestHelper.getRoleMock({
                            permissions: [Permissions.ADD_REACTION, Permissions.REMOVE_REACTION],
                        }),
                    },
                },
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: TestHelper.getUserMock({id: userId, roles: 'system_user'}),
                        user_id_2: TestHelper.getUserMock({id: 'user_id_2', username: 'other-user'}),
                    },
                },
            },
        };

        let reactionsSpy: jest.SpiedFunction<typeof Client4.getReactionsForPost> | undefined;

        beforeAll(() => {
            setSystemEmojis(new Set(EmojiIndicesByAlias.keys()));
        });

        afterEach(() => {
            reactionsSpy?.mockRestore();
            reactionsSpy = undefined;
        });

        test('publishes core\'s PostReactions', () => {
            expect(publishedComponents.PostReactions).toBe(PublishedPostReactions);
        });

        test('fetches reactions missing from the store and shows them', async () => {
            reactionsSpy = jest.spyOn(Client4, 'getReactionsForPost').mockResolvedValue([reaction]);

            const {PostReactions} = publishedComponents;
            const {store} = renderWithContext(
                <PostReactions post={post}/>,
                initialState,
            );

            expect(reactionsSpy).toHaveBeenCalledTimes(1);
            expect(reactionsSpy).toHaveBeenCalledWith(post.id);

            expect(await screen.findByRole('button', {name: /smile/})).toBeInTheDocument();
            expect(getReactionsForPosts(store.getState())[post.id]).toEqual({
                [`${reaction.user_id}-${reaction.emoji_name}`]: reaction,
            });
        });

        test('replaces a partial store entry with the fetched reactions', async () => {
            const staleReaction = {...reaction, user_id: userId, emoji_name: 'thumbsup'};
            const missingReaction = {...reaction, emoji_name: 'heart'};
            reactionsSpy = jest.spyOn(Client4, 'getReactionsForPost').mockResolvedValue([reaction, missingReaction]);

            const {PostReactions} = publishedComponents;
            const {store} = renderWithContext(
                <PostReactions post={post}/>,
                {
                    ...initialState,
                    entities: {
                        ...initialState.entities,
                        posts: {
                            reactions: {
                                [post.id]: {
                                    [`${reaction.user_id}-${reaction.emoji_name}`]: reaction,
                                    [`${staleReaction.user_id}-${staleReaction.emoji_name}`]: staleReaction,
                                },
                            },
                        },
                    },
                },
            );

            expect(reactionsSpy).toHaveBeenCalledTimes(1);
            expect(reactionsSpy).toHaveBeenCalledWith(post.id);

            expect(await screen.findByRole('button', {name: /heart/})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /smile/})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /thumbsup/})).not.toBeInTheDocument();
            expect(getReactionsForPosts(store.getState())[post.id]).toEqual({
                [`${reaction.user_id}-${reaction.emoji_name}`]: reaction,
                [`${missingReaction.user_id}-${missingReaction.emoji_name}`]: missingReaction,
            });
        });
    });
});
