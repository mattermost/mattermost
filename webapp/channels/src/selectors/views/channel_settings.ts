// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Permissions} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

/**
 * Selector to determine if a user has access to any tab in the channel settings modal
 * Returns true if the user has permission to access at least one tab (Info, Configuration, Archive)
 * Note: This does not check license requirements - those should be handled by the calling component
 */
export const canAccessChannelSettings = createSelector(
    'canAccessChannelSettings',
    (state: GlobalState) => state,
    (state: GlobalState) => state.entities.channels.channels,
    (state: GlobalState, channelId: string) => channelId,
    (state: GlobalState) => getConfig(state)?.RestrictDMAndGMAutotranslation === 'true',
    (state: GlobalState) => getConfig(state)?.EnableAutoTranslation === 'true',
    (state, channels, channelId, isDMAndGMAutotranslationRestricted, isAutoTranslationEnabled) => {
        const channel = channels[channelId];
        if (!channel) {
            return false;
        }

        const isDM = channel.type === Constants.DM_CHANNEL;
        const isGM = channel.type === Constants.GM_CHANNEL;

        // For DM and GM: allow Channel Settings when "Restrict auto-translation on DM and GM" is not enabled
        if (isDM || isGM) {
            return isAutoTranslationEnabled && !isDMAndGMAutotranslationRestricted;
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

        const hasBannerPermission = haveIChannelPermission(
            state,
            teamId,
            channelId,
            bannerPermission,
        );

        // Configuration tab (translation) permissions
        const translationPermission = isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_AUTO_TRANSLATION : Permissions.MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION;
        const hasTranslationPermission = haveIChannelPermission(
            state,
            teamId,
            channelId,
            translationPermission,
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
        return hasInfoPermission || hasBannerPermission || hasTranslationPermission || hasArchivePermission;
    },
);
