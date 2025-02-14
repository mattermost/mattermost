// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {canAddReactions} from 'mattermost-redux/selectors/entities/reactions';

import {toggleReaction} from 'actions/post_actions';

import {makeGetUniqueReactionsToPost} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import ReactionList from './reaction_list';

type Props = {
    post: Post;
};

function makeMapStateToProps() {
    const getReactionsForPost = makeGetUniqueReactionsToPost();

    return function mapStateToProps(state: GlobalState, ownProps: Props) {
        const channelId = ownProps.post.channel_id;

        const channel = getChannel(state, channelId);
        const teamId = channel?.team_id ?? '';

        const config = getConfig(state);
        const maxUniqueReactions = parseInt(config.UniqueEmojiReactionLimitPerPost ?? '0', 10);

        return {
            teamId,
            reactions: getReactionsForPost(state, ownProps.post.id),
            canAddReactions: canAddReactions(state, channelId),
            maxUniqueReactions,
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            toggleReaction,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ReactionList);
