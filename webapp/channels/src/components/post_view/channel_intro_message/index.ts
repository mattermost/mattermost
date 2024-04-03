// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {getTotalUsersStats} from 'mattermost-redux/actions/users';
import {getCurrentChannel, getDirectTeammate, getMyCurrentChannelMembership, isCurrentChannelFavorite} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser, getProfilesInCurrentChannel, getCurrentUserId, getUser, getTotalUsersStats as getTotalUsersStatsSelector} from 'mattermost-redux/selectors/entities/users';

import {getCurrentLocale} from 'selectors/i18n';
import {getIsMobileView} from 'selectors/views/browser';

import {Preferences} from 'utils/constants';
import {getDisplayNameByUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import ChannelIntroMessage from './channel_intro_message';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const enableUserCreation = config.EnableUserCreation === 'true';
    const isReadOnly = false;
    const team = getCurrentTeam(state);
    const channel = getCurrentChannel(state) || {};
    const channelMember = getMyCurrentChannelMembership(state);
    const teammate = getDirectTeammate(state, channel.id);
    const currentUser = getCurrentUser(state);
    const creator = getUser(state, channel.creator_id);

    const usersLimit = 10;

    const stats = getTotalUsersStatsSelector(state) || {total_users_count: 0};

    return {
        currentUserId: getCurrentUserId(state),
        channel,
        fullWidth: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
        locale: getCurrentLocale(state),
        channelProfiles: getProfilesInCurrentChannel(state),
        enableUserCreation,
        isReadOnly,
        isFavorite: isCurrentChannelFavorite(state),
        teamIsGroupConstrained: Boolean(team.group_constrained),
        creatorName: getDisplayNameByUser(state, creator),
        teammate,
        teammateName: getDisplayNameByUser(state, teammate),
        currentUser,
        stats,
        usersLimit,
        channelMember,
        isMobileView: getIsMobileView(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getTotalUsersStats,
            favoriteChannel,
            unfavoriteChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelIntroMessage);
