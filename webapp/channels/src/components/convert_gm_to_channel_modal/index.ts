// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'types/store';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';
import ConvertGmToChannelModal, {Props} from 'components/convert_gm_to_channel_modal/convert_gm_to_channel_modal';
import {Action, ActionResult} from 'mattermost-redux/types/actions';
import {closeModal} from 'actions/views/modals';
import {
    getCurrentUserId,
    makeGetProfilesInChannel,
} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {convertGroupMessageToPrivateChannel} from 'mattermost-redux/actions/channels';
import {moveChannelsInSidebar} from 'actions/views/channel_sidebar';
import {getCategoryInTeamByType} from 'mattermost-redux/selectors/entities/channel_categories';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const allProfilesInChannel = makeGetProfilesInChannel()(state, ownProps.channel.id);
    const currentUserId = getCurrentUserId(state);
    const validProfilesInChannel = allProfilesInChannel.filter(
        (user) => user.id !== currentUserId && user.delete_at === 0,
    );

    const currentTeamId = getCurrentTeamId(state);
    const teammateNameDisplaySetting = getTeammateNameDisplaySetting(state);
    const channelsCategory = getCategoryInTeamByType(state, currentTeamId, CategoryTypes.CHANNELS);

    return {
        profilesInChannel: validProfilesInChannel,
        teammateNameDisplaySetting,
        channelsCategoryId: channelsCategory?.id,
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

export default connect(mapStateToProps, mapDispatchToProps)(ConvertGmToChannelModal);
