// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getMyChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {uploadFile} from 'actions/file_actions';
import {getCurrentLocale} from 'selectors/i18n';
import {getEditingPostDetailsAndPost} from 'selectors/posts';

import {canUploadFiles} from 'utils/file_utils';

import type {GlobalState} from 'types/store';

import FileUpload from './file_upload';

type OwnProps = {
    channelId: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const maxFileSize = parseInt(config.MaxFileSize || '', 10);

    const editingPost = getEditingPostDetailsAndPost(state);
    const centerChannelPostBeingEdited = editingPost.show && !editingPost.isRHS;
    const rhsPostBeingEdited = editingPost.show && editingPost.isRHS;

    const membership = getMyChannelMembership(state, ownProps.channelId);

    return {
        maxFileSize,
        canUploadFiles: canUploadFiles(config),
        fileUploadRestrictedByPolicy: membership?.file_upload_restricted ?? false,
        locale: getCurrentLocale(state),
        pluginFileUploadMethods: state.plugins.components.FileUploadMethod,
        pluginFilesWillUploadHooks: state.plugins.components.FilesWillUploadHook,
        centerChannelPostBeingEdited,
        rhsPostBeingEdited,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            uploadFile,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef: true})(FileUpload);
