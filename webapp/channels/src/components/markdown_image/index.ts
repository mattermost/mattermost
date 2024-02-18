// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

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

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(MarkdownImage);
