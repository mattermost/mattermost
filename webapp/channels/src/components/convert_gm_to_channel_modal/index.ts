// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {Dispatch} from 'redux';
import {bindActionCreators} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {convertGroupMessageToPrivateChannel} from 'mattermost-redux/actions/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {
    getCurrentUserId,
    makeGetProfilesInChannel,
} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {moveChannelsInSidebar} from 'actions/views/channel_sidebar';
import {closeModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import ConvertGmToChannelModal from './convert_gm_to_channel_modal';

type OwnProps = {
    channel: Channel;
}
function makeMapStateToProps() {
    const getProfilesInChannel = makeGetProfilesInChannel();

    return (state: GlobalState, ownProps: OwnProps) => {
        const allProfilesInChannel = getProfilesInChannel(state, ownProps.channel.id);
        const currentUserId = getCurrentUserId(state);
        const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state);

        return {
            profilesInChannel: allProfilesInChannel,
            teammateNameDisplaySetting,
            currentUserId,
        };
    };
}

export type Actions = {
    closeModal: (modalID: string) => void;
    convertGroupMessageToPrivateChannel: (channelID: string, teamID: string, displayName: string, name: string) => Promise<ActionResult>;
    moveChannelsInSidebar: (categoryId: string, targetIndex: number, draggableChannelId: string, setManualSorting?: boolean) => void;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            closeModal,
            convertGroupMessageToPrivateChannel,
            moveChannelsInSidebar,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ConvertGmToChannelModal);
