// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {canAddReactions} from 'mattermost-redux/selectors/entities/reactions';

import {GenericAction} from 'mattermost-redux/types/actions';
import {Post} from '@mattermost/types/posts';

import {GlobalState} from 'types/store';

import {addReaction} from 'actions/post_actions';

import {makeGetUniqueReactionsToPost} from 'utils/post_utils';

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

        return {
            teamId,
            reactions: getReactionsForPost(state, ownProps.post.id),
            canAddReactions: canAddReactions(state, channelId),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            addReaction,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ReactionList);
