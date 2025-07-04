// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import type {Dispatch} from 'redux';

import ImageGallery from './image_gallery';

import {makeGetFilesForPost} from '../../../packages/mattermost-redux/src/selectors/entities/files';
import type {GlobalState} from '../../../types/store';

function makeMapStateToProps() {
    const selectFilesForPost = makeGetFilesForPost();

    return function mapStateToProps(state: GlobalState, ownProps: {postId: string}) {
        return {
            allFilesForPost: selectFilesForPost(state, ownProps.postId),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        // handleImageClick removed - SingleImageView now handles all image clicks with its default behavior
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(ImageGallery);
