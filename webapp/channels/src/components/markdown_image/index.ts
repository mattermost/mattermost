// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Action, GenericAction} from 'mattermost-redux/types/actions';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import MarkdownImage from './markdown_image';
import type {Props} from './markdown_image';

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const post = getPost(state, ownProps.postId);
    const isUnsafeLinksPost = post?.props?.unsafe_links === 'true';

    return {
        isUnsafeLinksPost,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Props['actions']>({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(MarkdownImage);
