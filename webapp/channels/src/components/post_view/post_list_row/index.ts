// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GenericAction} from 'mattermost-redux/types/actions';

import {getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';
import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';

import {GlobalState} from 'types/store';

import {getUsage} from 'mattermost-redux/selectors/entities/usage';
import {getCloudLimits, getCloudLimitsLoaded} from 'mattermost-redux/selectors/entities/cloud';
import {getLimitedViews, getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {PostListRowListIds} from 'utils/constants';

import PostListRow, {PostListRowProps} from './post_list_row';

type OwnProps = Pick<PostListRowProps, 'listId'>

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const shortcutReactToLastPostEmittedFrom = getShortcutReactToLastPostEmittedFrom(state);
    const usage = getUsage(state);
    const limits = getCloudLimits(state);
    const limitsLoaded = getCloudLimitsLoaded(state);
    const post = getPost(state, ownProps.listId);
    const currentUserId = getCurrentUserId(state);
    const newMessagesSeparatorActions = state.plugins.components.NewMessagesSeparatorAction;

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
        newMessagesSeparatorActions,
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
