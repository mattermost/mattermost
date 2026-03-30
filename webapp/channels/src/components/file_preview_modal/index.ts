// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import Permissions from 'mattermost-redux/constants/permissions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {getIsMobileView} from 'selectors/views/browser';

import {makeAsyncComponent} from 'components/async_load';

import {canDownloadFiles} from 'utils/file_utils';

import type {GlobalState} from 'types/store';

import type {Props} from './file_preview_modal';

const FilePreviewModal = makeAsyncComponent('FilePreviewModal', React.lazy<React.ComponentType<Props>>(() => import('./file_preview_modal')));

type OwnProps = {
    post?: Post;
    postId?: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const post = ownProps.post || getPost(state, ownProps.postId || '');
    const channel = post.channel_id ? getChannel(state, post.channel_id) : undefined;
    const hasDownloadPermission = channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DOWNLOAD_FILE_ATTACHMENT) : true;

    return {
        canDownloadFiles: canDownloadFiles(config) && hasDownloadPermission,
        enablePublicLink: config.EnablePublicLink === 'true',
        isMobileView: getIsMobileView(state),
        pluginFilePreviewComponents: state.plugins.components.FilePreview,
        post,
    };
}

export default connect(mapStateToProps)(FilePreviewModal);
