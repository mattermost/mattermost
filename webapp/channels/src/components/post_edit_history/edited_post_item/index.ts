// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {openModal} from 'actions/views/modals';
import {editPost} from 'actions/views/posts';
import {closeRightHandSide} from 'actions/views/rhs';
import {getSelectedPostId} from 'selectors/rhs';

import type {GlobalState} from 'types/store';

import EditedPostItem from './edited_post_item';

function mapStateToProps(state: GlobalState) {
    const selectedPostId = getSelectedPostId(state) || '';
    const theme = getTheme(state);

    return {
        theme,
        postCurrentVersion: getPost(state, selectedPostId),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            editPost,
            closeRightHandSide,
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EditedPostItem);
