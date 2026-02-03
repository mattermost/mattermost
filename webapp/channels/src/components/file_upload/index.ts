// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {uploadFile} from 'actions/file_actions';
import {getCurrentLocale} from 'selectors/i18n';
import {getEditingPostDetailsAndPost} from 'selectors/posts';

import {canUploadFiles} from 'utils/file_utils';

import type {GlobalState} from 'types/store';

import FileUpload from './file_upload';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const maxFileSize = parseInt(config.MaxFileSize || '', 10);

    const editingPost = getEditingPostDetailsAndPost(state);
    const centerChannelPostBeingEdited = editingPost.show && !editingPost.isRHS;
    const rhsPostBeingEdited = editingPost.show && editingPost.isRHS;

    return {
        maxFileSize,
        canUploadFiles: canUploadFiles(config),
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
