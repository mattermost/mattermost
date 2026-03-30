// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import Permissions from 'mattermost-redux/constants/permissions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {canDownloadFiles} from 'utils/file_utils';

import type {GlobalState} from 'types/store';

import FileInfoPreview from './file_info_preview';

type OwnProps = {
    fileInfo: FileInfo;
    fileUrl: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const channel = getChannel(state, ownProps.fileInfo.channel_id);
    const hasDownloadPermission = channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DOWNLOAD_FILE_ATTACHMENT) : true;

    return {
        canDownloadFiles: canDownloadFiles(config) && hasDownloadPermission,
    };
}

export default connect(mapStateToProps)(FileInfoPreview);
