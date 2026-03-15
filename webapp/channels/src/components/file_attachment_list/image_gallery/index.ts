// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

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

const connector = connect(makeMapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(ImageGallery);
