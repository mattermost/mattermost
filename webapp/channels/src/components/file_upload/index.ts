// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {uploadFile} from 'actions/file_actions';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentLocale} from 'selectors/i18n';

import {GlobalState} from 'types/store';
import {FilesWillUploadHook} from 'types/store/plugins';
import {canUploadFiles} from 'utils/file_utils';

import FileUpload, {Props} from './file_upload';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const maxFileSize = parseInt(config.MaxFileSize || '', 10);

    return {
        maxFileSize,
        canUploadFiles: canUploadFiles(config),
        locale: getCurrentLocale(state),
        pluginFileUploadMethods: state.plugins.components.FileUploadMethod,
        pluginFilesWillUploadHooks: state.plugins.components.FilesWillUploadHook as unknown as FilesWillUploadHook[],
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Props['actions']>({
            uploadFile,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef: true})(FileUpload);
