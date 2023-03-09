// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {Post} from '@mattermost/types/posts';

import {GlobalState} from 'types/store';
import {ModalData} from 'types/actions';
import {editPost} from 'actions/views/posts';

import {getSelectedPostId} from 'selectors/rhs';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {closeRightHandSide} from 'actions/views/rhs';
import {openModal} from 'actions/views/modals';

import EditedPostItem from './edited_post_item';

function mapStateToProps(state: GlobalState) {
    const selectedPostId = getSelectedPostId(state) || '';

    return {
        postCurrentVersion: getPost(state, selectedPostId),
    };
}

type Actions = {
    editPost: (post: Post) => Promise<{data: Post}>;
    closeRightHandSide: () => void;
    openModal: <P>(modalData: ModalData<P>) => void;
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            editPost,
            closeRightHandSide,
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EditedPostItem);
