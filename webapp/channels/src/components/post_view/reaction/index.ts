// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';
import {injectIntl} from 'react-intl';

import type {Emoji as EmojiType} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';
import type {Reaction as ReactionType} from '@mattermost/types/reactions';
import type {GlobalState} from '@mattermost/types/store';

import {removeReaction} from 'mattermost-redux/actions/posts';
import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {canAddReactions, canRemoveReactions} from 'mattermost-redux/selectors/entities/reactions';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {addReaction} from 'actions/post_actions';

import * as Emoji from 'utils/emoji';

import Reaction from './reaction';
import {makeGetNamesOfUsers} from './reaction_tooltip';

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

    const getNamesOfUsers = makeGetNamesOfUsers();

    return function mapStateToProps(state: GlobalState, ownProps: Props) {
        const channelId = ownProps.post.channel_id;

        let emoji;
        if (Emoji.EmojiIndicesByAlias.has(ownProps.emojiName)) {
            emoji = Emoji.Emojis[Emoji.EmojiIndicesByAlias.get(ownProps.emojiName) as number];
        } else {
            const emojis = getCustomEmojisByName(state);
            emoji = emojis.get(ownProps.emojiName);
        }

        let emojiImageUrl = '';
        if (emoji) {
            emojiImageUrl = getEmojiImageUrl(emoji as EmojiType);
        }
        const currentUserId = getCurrentUserId(state);

        return {
            currentUserId,
            reactionCount: ownProps.reactions.length,
            canAddReactions: canAddReactions(state, channelId),
            canRemoveReactions: canRemoveReactions(state, channelId),
            emojiImageUrl,
            currentUserReacted: didCurrentUserReact(state, ownProps.reactions),
            users: getNamesOfUsers(state, ownProps.reactions),
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

export default injectIntl(connect(makeMapStateToProps, mapDispatchToProps)(Reaction));
