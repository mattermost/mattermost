// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {makeGetFilesForPost} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';
import {getCurrentLocale} from 'selectors/i18n';
import {isEmbedVisible} from 'selectors/posts';

import FileAttachmentList from './file_attachment_list';

import type {Post} from '@mattermost/types/posts';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {ConnectedProps} from 'react-redux';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

export type OwnProps = {
    post: Post;
    compactDisplay?: boolean;
    isInPermalink?: boolean;
    handleFileDropdownOpened?: (open: boolean) => void;
}

function makeMapStateToProps() {
    const selectFilesForPost = makeGetFilesForPost();

    return function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
        const postId = ownProps.post ? ownProps.post.id : '';
        const fileInfos = selectFilesForPost(state, postId);

        let fileCount = 0;
        if (ownProps.post.metadata && ownProps.post.metadata.files) {
            fileCount = (ownProps.post.metadata.files || []).length;
        } else if (ownProps.post.file_ids) {
            fileCount = ownProps.post.file_ids.length;
        } else if (ownProps.post.filenames) {
            fileCount = ownProps.post.filenames.length;
        }

        return {
            enableSVGs: getConfig(state).EnableSVGs === 'true',
            fileInfos,
            fileCount,
            isEmbedVisible: isEmbedVisible(state, ownProps.post.id),
            locale: getCurrentLocale(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(FileAttachmentList);
