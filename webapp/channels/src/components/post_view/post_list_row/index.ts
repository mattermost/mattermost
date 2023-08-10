// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getCloudLimits, getCloudLimitsLoaded} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getLimitedViews, getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUsage} from 'mattermost-redux/selectors/entities/usage';

import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';

import {PostListRowListIds} from 'utils/constants';

import PostListRow from './post_list_row';

import type {PostListRowProps} from './post_list_row';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

type OwnProps = Pick<PostListRowProps, 'listId'>

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const shortcutReactToLastPostEmittedFrom = getShortcutReactToLastPostEmittedFrom(state);
    const usage = getUsage(state);
    const limits = getCloudLimits(state);
    const limitsLoaded = getCloudLimitsLoaded(state);
    const post = getPost(state, ownProps.listId);
    const currentUserId = getCurrentUserId(state);

    const props: Pick<
    PostListRowProps,
    'shortcutReactToLastPostEmittedFrom' | 'usage' | 'limits' | 'limitsLoaded' | 'exceededLimitChannelId' | 'firstInaccessiblePostTime' | 'post' | 'currentUserId'
    > = {
        shortcutReactToLastPostEmittedFrom,
        usage,
        limits,
        limitsLoaded,
        post,
        currentUserId,
    };
    if ((ownProps.listId === PostListRowListIds.OLDER_MESSAGES_LOADER || ownProps.listId === PostListRowListIds.CHANNEL_INTRO_MESSAGE) && limitsLoaded) {
        const currentChannelId = getCurrentChannelId(state);
        const firstInaccessiblePostTime = getLimitedViews(state).channels[currentChannelId];
        const channelLimitExceeded = Boolean(firstInaccessiblePostTime) || firstInaccessiblePostTime === 0;
        if (channelLimitExceeded) {
            props.exceededLimitChannelId = currentChannelId;
            props.firstInaccessiblePostTime = firstInaccessiblePostTime;
        }
    }
    return props;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            emitShortcutReactToLastPostFrom,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostListRow);
