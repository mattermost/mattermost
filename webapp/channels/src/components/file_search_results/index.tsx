// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FileInfo} from '@mattermost/types/files';
import {connect, ConnectedProps} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {GenericAction} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';
import {FileDropdownPluginComponent} from 'types/store/plugins';

import FileSearchResultItem from './file_search_result_item';

export type OwnProps = {
    channelId: string;
    fileInfo: FileInfo;
    teamName: string;
    pluginMenuItems?: FileDropdownPluginComponent[];
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const channel = getChannel(state, ownProps.channelId);

    return {
        channelDisplayName: '',
        channelType: channel.type,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(FileSearchResultItem);
