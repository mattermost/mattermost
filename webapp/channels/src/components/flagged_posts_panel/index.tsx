// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {getMoreFlaggedPosts} from 'mattermost-redux/actions/flagged_posts';
import {
    getFlaggedPosts,
    getIsFlaggedPostsLoading,
    getIsFlaggedPostsLoadingMore,
    getIsFlaggedPostsEnd,
} from 'mattermost-redux/selectors/entities/flagged_posts';
import {makeAddDateSeparatorsForSearchResults} from 'mattermost-redux/utils/post_list';

import type {GlobalState} from 'types/store';

import FlaggedPostsPanel from './flagged_posts_panel';
import type {StateProps, DispatchProps} from './types';

function makeMapStateToProps() {
    const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();

    return function mapStateToProps(state: GlobalState): StateProps {
        const posts = getFlaggedPosts(state);
        const postsWithDateSeparators = addDateSeparatorsForSearchResults(state, posts) as Post[];

        return {
            posts: postsWithDateSeparators,
            isLoading: getIsFlaggedPostsLoading(state),
            isLoadingMore: getIsFlaggedPostsLoadingMore(state),
            isEnd: getIsFlaggedPostsEnd(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
    return {
        actions: bindActionCreators({
            getMoreFlaggedPosts,
        }, dispatch),
    };
}

export default connect<StateProps, DispatchProps, Record<string, never>, GlobalState>(
    makeMapStateToProps,
    mapDispatchToProps,
)(FlaggedPostsPanel);
