// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {makeGenerateCombinedPost} from 'mattermost-redux/utils/post_list';

import Post from 'components/post';

import {GlobalState} from 'types/store';
import {shouldShowDotMenu} from 'utils/post_utils';

type Props = {
    combinedId: string;
    shouldHighlight?: boolean;
    shouldShowDotMenu?: boolean;
}

function makeMapStateToProps() {
    const generateCombinedPost = makeGenerateCombinedPost();

    return (state: GlobalState, ownProps: Props) => {
        const post = generateCombinedPost(state, ownProps.combinedId);
        const channel = state.entities.channels.channels[post.channel_id];

        return {
            post,
            postId: ownProps.combinedId,
            shouldHighlight: ownProps.shouldHighlight,
            shouldShowDotMenu: shouldShowDotMenu(state, post, channel),
        };
    };
}

// Note that this also passes through Post's mapStateToProps
export default connect(makeMapStateToProps)(Post);
