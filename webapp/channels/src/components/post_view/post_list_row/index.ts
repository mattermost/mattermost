// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GenericAction} from 'mattermost-redux/types/actions';

import {getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';
import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';

import {GlobalState} from 'types/store';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import PostListRow, {PostListRowProps} from './post_list_row';

type OwnProps = Pick<PostListRowProps, 'listId'>

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const shortcutReactToLastPostEmittedFrom = getShortcutReactToLastPostEmittedFrom(state);
    const post = getPost(state, ownProps.listId);
    const currentUserId = getCurrentUserId(state);
    const newMessagesSeparatorActions = state.plugins.components.NewMessagesSeparatorAction;

    const props: Pick<
    PostListRowProps,
    'shortcutReactToLastPostEmittedFrom' | 'exceededLimitChannelId' | 'firstInaccessiblePostTime' | 'post' | 'currentUserId' | 'newMessagesSeparatorActions'
    > = {
        shortcutReactToLastPostEmittedFrom,
        post,
        currentUserId,
        newMessagesSeparatorActions,
    };
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
