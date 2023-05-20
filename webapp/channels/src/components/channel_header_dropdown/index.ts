// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {
    getUser,
    getCurrentUser,
    getUserStatuses,
    getCurrentUserId,
} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {
    getCurrentChannel,
    isCurrentChannelDefault,
    isCurrentChannelFavorite,
    isCurrentChannelMuted,
    isCurrentChannelArchived,
    getRedirectChannelNameForTeam,
} from 'mattermost-redux/selectors/entities/channels';

import {getPenultimateViewedChannelName} from 'selectors/local_storage';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

import {getChannelHeaderMenuPluginComponents} from 'selectors/plugins';

import {GlobalState} from 'types/store';

import Desktop from './channel_header_dropdown';
import Items from './channel_header_dropdown_items';
import Mobile from './mobile_channel_header_dropdown';

const getTeammateId = createSelector(
    'getTeammateId',
    getCurrentChannel,
    getCurrentUserId,
    (channel, currentUserId) => {
        if (channel.type !== Constants.DM_CHANNEL) {
            return null;
        }

        return Utils.getUserIdFromChannelId(channel.name, currentUserId);
    },
);

const getTeammateStatus = createSelector(
    'getTeammateStatus',
    getUserStatuses,
    getTeammateId,
    (userStatuses, teammateId) => {
        if (!teammateId) {
            return undefined;
        }

        return userStatuses[teammateId];
    },
);

const mapStateToProps = (state: GlobalState) => ({
    user: getCurrentUser(state),
    channel: getCurrentChannel(state),
    isDefault: isCurrentChannelDefault(state),
    isFavorite: isCurrentChannelFavorite(state),
    isMuted: isCurrentChannelMuted(state),
    isReadonly: false,
    isArchived: isCurrentChannelArchived(state),
    penultimateViewedChannelName: getPenultimateViewedChannelName(state) || getRedirectChannelNameForTeam(state, getCurrentTeamId(state)),
    pluginMenuItems: getChannelHeaderMenuPluginComponents(state),
    isLicensedForLDAPGroups: state.entities.general.license.LDAPGroups === 'true',
});

const mobileMapStateToProps = (state: GlobalState) => {
    const user = getCurrentUser(state);
    const channel = getCurrentChannel(state);
    const teammateId = getTeammateId(state);

    let teammateIsBot = false;
    let displayName = '';
    if (teammateId) {
        const teammate = getUser(state, teammateId);
        teammateIsBot = teammate && teammate.is_bot;
        displayName = Utils.getDisplayNameByUser(state, teammate);
    }

    return {
        user,
        channel,
        teammateId,
        teammateIsBot,
        teammateStatus: getTeammateStatus(state),
        displayName,
    };
};

export const ChannelHeaderDropdown = Desktop;
export const ChannelHeaderDropdownItems = connect(mapStateToProps)(Items);
export const MobileChannelHeaderDropdown = connect(mobileMapStateToProps)(Mobile);
