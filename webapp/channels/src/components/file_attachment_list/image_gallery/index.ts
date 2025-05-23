// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {FileInfo} from '@mattermost/types/files';

import {makeGetFilesForPost} from '../../../packages/mattermost-redux/src/selectors/entities/files';
import {openModal} from '../../../actions/views/modals';
import {ModalIdentifiers} from '../../../utils/constants';
import FilePreviewModal from '../../../components/file_preview_modal';
import type {GlobalState} from '../../../types/store';

import ImageGallery from './image_gallery';

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
        handleImageClick: (index: number, fileInfos: FileInfo[]) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                dialogType: FilePreviewModal,
                dialogProps: {
                    fileInfos,
                    startIndex: index,
                    onExited: () => {},
                    handleImageClick: () => {},
                    postId: fileInfos[0]?.post_id,
                },
            }));
        },
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(ImageGallery); 