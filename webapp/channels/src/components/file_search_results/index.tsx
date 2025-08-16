// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {FileInfo} from '@mattermost/types/files';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';
import type {FilesDropdownAction} from 'types/store/plugins';

import FileSearchResultItem from './file_search_result_item';

export type OwnProps = {
    channelId: string;
    fileInfo: FileInfo;
    teamName: string;
    pluginMenuItems?: FilesDropdownAction[];
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const channel = getChannel(state, ownProps.channelId);
    const enableSharedChannelsPlugins = getFeatureFlagValue(state, 'EnableSharedChannelsPlugins') === 'true';

    return {
        channelDisplayName: '',
        channelType: channel?.type,
        channel,
        enableSharedChannelsPlugins,
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

export default connector(FileSearchResultItem);
