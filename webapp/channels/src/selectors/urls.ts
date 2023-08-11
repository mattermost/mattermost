// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';

import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {
    getCurrentRelativeTeamUrl,
    getCurrentTeam,
    getCurrentTeamId,
    getTeam,
} from 'mattermost-redux/selectors/entities/teams';

import type {GlobalState} from 'types/store';
import Constants from 'utils/constants';

function getTeamRelativeUrl(team: Team | undefined) {
    if (!team) {
        return '';
    }

    return '/' + team.name;
}

export function getPermalinkURL(state: GlobalState, teamId: Team['id'], postId: Post['id']): string {
    let team = getTeam(state, teamId);
    if (!team) {
        team = getCurrentTeam(state);
    }
    return `${getTeamRelativeUrl(team)}/pl/${postId}`;
}

export function getChannelURL(state: GlobalState, channel: Channel, teamId: string): string {
    let notificationURL;
    if (channel && (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL)) {
        notificationURL = getCurrentRelativeTeamUrl(state) + '/channels/' + channel.name;
    } else if (channel) {
        const team = getTeam(state, teamId);
        notificationURL = getTeamRelativeUrl(team) + '/channels/' + channel.name;
    } else if (teamId) {
        const team = getTeam(state, teamId);
        const redirectChannel = getRedirectChannelNameForTeam(state, teamId);
        notificationURL = getTeamRelativeUrl(team) + `/channels/${redirectChannel}`;
    } else {
        const currentTeamId = getCurrentTeamId(state);
        const redirectChannel = getRedirectChannelNameForTeam(state, currentTeamId);
        notificationURL = getCurrentRelativeTeamUrl(state) + `/channels/${redirectChannel}`;
    }
    return notificationURL;
}
