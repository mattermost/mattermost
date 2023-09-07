// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import {bindActionCreators} from 'redux';

import {convertGroupMessageToPrivateChannel} from 'mattermost-redux/actions/channels';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getCategoryInTeamByType} from 'mattermost-redux/selectors/entities/channel_categories';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentUserId,
    makeGetProfilesInChannel,
} from 'mattermost-redux/selectors/entities/users';
import type {Action, ActionResult} from 'mattermost-redux/types/actions';

import {moveChannelsInSidebar} from 'actions/views/channel_sidebar';
import {closeModal} from 'actions/views/modals';

import type {Props} from 'components/convert_gm_to_channel_modal/convert_gm_to_channel_modal';
import ConvertGmToChannelModal from 'components/convert_gm_to_channel_modal/convert_gm_to_channel_modal';

import type {GlobalState} from 'types/store';

function makeMapStateToProps() {
    const getProfilesInChannel = makeGetProfilesInChannel();

    return (state: GlobalState, ownProps: Props) => {
        const allProfilesInChannel = getProfilesInChannel(state, ownProps.channel.id);
        const currentUserId = getCurrentUserId(state);
        const currentTeamId = getCurrentTeamId(state);
        const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state);
        const channelsCategory = getCategoryInTeamByType(state, currentTeamId, CategoryTypes.CHANNELS);

        return {
            profilesInChannel: allProfilesInChannel,
            teammateNameDisplaySetting,
            channelsCategoryId: channelsCategory?.id,
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
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            closeModal,
            convertGroupMessageToPrivateChannel,
            moveChannelsInSidebar,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ConvertGmToChannelModal);
