// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Permissions} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {selectChannelBannerEnabled} from 'mattermost-redux/selectors/entities/channel_banner';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

/**
 * Selector to determine if a user has access to any tab in the channel settings modal
 * Returns true if the user has permission to access at least one tab (Info, Configuration, Archive)
 */
export const canAccessChannelSettings = createSelector(
    'canAccessChannelSettings',
    (state: GlobalState) => state,
    (state: GlobalState) => state.entities.channels.channels,
    (state: GlobalState) => selectChannelBannerEnabled(state),
    (state: GlobalState, channelId: string) => channelId,
    (state, channels, bannerEnabled, channelId) => {
        const channel = channels[channelId];
        if (!channel) {
            return false;
        }

        const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
        const isDefaultChannel = channel.name === Constants.DEFAULT_CHANNEL;

        // Get the team ID from the channel
        const teamId = channel.team_id;

        // Info tab permissions
        const infoPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;

        const hasInfoPermission = haveIChannelPermission(
            state,
            teamId,
            channelId,
            infoPermission,
        );

        // Configuration tab (banner) permissions
        const bannerPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_BANNER : Permissions.MANAGE_PUBLIC_CHANNEL_BANNER;

        const hasBannerPermission = bannerEnabled && haveIChannelPermission(
            state,
            teamId,
            channelId,
            bannerPermission,
        );

        // Archive tab permissions
        const archivePermission = isPrivate ? Permissions.DELETE_PRIVATE_CHANNEL : Permissions.DELETE_PUBLIC_CHANNEL;

        const hasArchivePermission = !isDefaultChannel && haveIChannelPermission(
            state,
            teamId,
            channelId,
            archivePermission,
        );

        // User can access channel settings if they have permission for at least one tab
        return hasInfoPermission || hasBannerPermission || hasArchivePermission;
    },
);
