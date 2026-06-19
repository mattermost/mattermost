// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';
import {editPost} from 'actions/views/posts';
import {closeRightHandSide} from 'actions/views/rhs';

import EditedPostItem from 'components/post_edit_history/edited_post_item/edited_post_item';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            editPost,
            closeRightHandSide,
            openModal,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EditedPostItem);
