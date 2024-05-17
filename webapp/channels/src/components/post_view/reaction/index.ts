// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {Reaction as ReactionType} from '@mattermost/types/reactions';
import type {GlobalState} from '@mattermost/types/store';

import {removeReaction} from 'mattermost-redux/actions/posts';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {canAddReactions, canRemoveReactions} from 'mattermost-redux/selectors/entities/reactions';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {addReaction} from 'actions/post_actions';

import {useEmojiByName} from 'data-layer/hooks/emojis';

import Reaction from './reaction';

type Props = {
    emojiName: string;
    post: Post;
    reactions: ReactionType[];
};

function makeMapStateToProps() {
    const didCurrentUserReact = createSelector(
        'didCurrentUserReact',
        getCurrentUserId,
        (state: GlobalState, reactions: ReactionType[]) => reactions,
        (currentUserId: string, reactions: ReactionType[]) => {
            return reactions.some((reaction) => reaction.user_id === currentUserId);
        },
    );

    return function mapStateToProps(state: GlobalState, ownProps: Props) {
        const channelId = ownProps.post.channel_id;

        const currentUserId = getCurrentUserId(state);

        return {
            currentUserId,
            reactionCount: ownProps.reactions.length,
            canAddReactions: canAddReactions(state, channelId),
            canRemoveReactions: canRemoveReactions(state, channelId),
            currentUserReacted: didCurrentUserReact(state, ownProps.reactions),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addReaction,
            removeReaction,
            getMissingProfilesByIds,
        }, dispatch),
    };
}

const ReactionWithHooks = (props: any) => {
    const emoji = useEmojiByName(props.emojiName);
    const emojiImageUrl = emoji ? getEmojiImageUrl(emoji) : '';

    return React.createElement(Reaction, {
        ...props,
        emojiImageUrl,
    });
};
ReactionWithHooks.displayName = 'Reaction';

export default connect(makeMapStateToProps, mapDispatchToProps)(ReactionWithHooks);
