// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {makeGenerateCombinedPagePost} from 'mattermost-redux/utils/post_list';

import Post from 'components/post';

import {shouldShowDotMenu} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

type Props = {
    combinedId: string;
    shouldHighlight?: boolean;
    shouldShowDotMenu?: boolean;
}

function makeMapStateToProps() {
    const generateCombinedPagePost = makeGenerateCombinedPagePost();

    return (state: GlobalState, ownProps: Props) => {
        const post = generateCombinedPagePost(state, ownProps.combinedId);
        const channel = state.entities.channels.channels[post.channel_id];

        return {
            post,
            postId: ownProps.combinedId,
            shouldHighlight: ownProps.shouldHighlight,
            shouldShowDotMenu: shouldShowDotMenu(state, post, channel),
        };
    };
}

export default connect(makeMapStateToProps)(Post);
