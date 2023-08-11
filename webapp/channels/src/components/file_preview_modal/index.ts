// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {getIsMobileView} from 'selectors/views/browser';

import {makeAsyncComponent} from 'components/async_load';

import type {GlobalState} from 'types/store';
import type {FilePreviewComponent} from 'types/store/plugins';
import {canDownloadFiles} from 'utils/file_utils';

import type {Props} from './file_preview_modal';

const FilePreviewModal = makeAsyncComponent('FilePreviewModal', React.lazy<React.ComponentType<Props>>(() => import('./file_preview_modal')));

type OwnProps = {
    post?: Post;
    postId?: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);

    return {
        canDownloadFiles: canDownloadFiles(config),
        enablePublicLink: config.EnablePublicLink === 'true',
        isMobileView: getIsMobileView(state),
        pluginFilePreviewComponents: state.plugins.components.FilePreview as unknown as FilePreviewComponent[],
        post: ownProps.post || getPost(state, ownProps.postId || ''),
    };
}

export default connect(mapStateToProps)(FilePreviewModal);
