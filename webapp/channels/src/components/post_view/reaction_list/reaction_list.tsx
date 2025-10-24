// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';
import type {Reaction as ReactionType} from '@mattermost/types/reactions';

import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import Reaction from 'components/post_view/reaction';

import AddReactionButton from './add_reaction_button';

type Props = {

    /**
     * The post to render reactions for
     */
    post: Post;

    /*
     * The id of the team which belongs the post
     */
    teamId: string;

    /**
     * The reactions to render
     */
    reactions: { [x: string]: ReactionType } | undefined | null;

    /**
     * Whether or not the user can add reactions to this post.
     */
    canAddReactions: boolean;

    actions: {

        /**
         * Function to add a reaction to the post
         */
        toggleReaction: (postId: string, emojiName: string) => void;
    };
};

const ReactionList: React.FC<Props> = ({post, teamId, reactions: reactionMap, canAddReactions, actions}) => {
    const intl = useIntl();

    const emojiNames = useMemo(() => {
        if (!reactionMap) {
            return [];
        }

        const names = Object.values(reactionMap).map((r) => r.emoji_name);
        return [...new Set(names)];
    }, [reactionMap]);

    const handleEmojiClick = useCallback((emoji: Emoji): void => {
        const emojiName = getEmojiName(emoji);
        actions.toggleReaction(post.id, emojiName);
    }, [post.id, actions.toggleReaction]);

    const reactionsByName = useMemo(() => {
        const map = new Map<string, ReactionType[]>();
        if (reactionMap) {
            for (const reaction of Object.values(reactionMap)) {
                const emojiName = reaction.emoji_name;

                if (map.has(emojiName)) {
                    map.get(emojiName)!.push(reaction);
                } else {
                    map.set(emojiName, [reaction]);
                }
            }
        }
        return map;
    }, [reactionMap]);

    if (reactionsByName.size === 0) {
        return null;
    }

    const reactionComponents = emojiNames.map((emojiName) => {
        if (reactionsByName.has(emojiName)) {
            return (
                <Reaction
                    key={emojiName}
                    post={post}
                    emojiName={emojiName}
                    reactions={reactionsByName.get(emojiName) || []}
                />
            );
        }
        return null;
    });

    return (
        <div
            aria-label={intl.formatMessage({id: 'reaction.container.ariaLabel', defaultMessage: 'reactions'})}
            className='post-reaction-list'
            role='group'
        >
            {reactionComponents}
            {canAddReactions && (
                <AddReactionButton
                    post={post}
                    teamId={teamId}
                    onEmojiClick={handleEmojiClick}
                />
            )}
        </div>
    );
};

export default ReactionList;
