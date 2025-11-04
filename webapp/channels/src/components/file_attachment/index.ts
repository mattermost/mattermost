// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {FileInfo} from '@mattermost/types/files';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {isFileRejected} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';
import {getFilesDropdownPluginMenuItems} from 'selectors/plugins';

import {canDownloadFiles} from 'utils/file_utils';

import type {GlobalState} from 'types/store';

import FileAttachment from './file_attachment';

export type OwnProps = {
    preventDownload?: boolean;
    fileInfo: FileInfo;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);

    return {
        canDownloadFiles: !ownProps.preventDownload && canDownloadFiles(config),
        enableSVGs: config.EnableSVGs === 'true',
        enablePublicLink: config.EnablePublicLink === 'true',
        pluginMenuItems: getFilesDropdownPluginMenuItems(state),
        currentChannel: getCurrentChannel(state),
        isFileRejected: isFileRejected(state, ownProps.fileInfo.id),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(FileAttachment);
