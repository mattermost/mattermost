// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {searchAssociatedGroupsForReferenceLocal} from 'mattermost-redux/selectors/entities/groups';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {searchGroups} from 'mattermost-redux/actions/groups';
import Permissions from 'mattermost-redux/constants/permissions';

export function searchAssociatedGroupsForReference(prefix, teamId, channelId) {
    return async (dispatch, getState) => {
        const state = getState();
        if (!haveIChannelPermission(state,
            teamId,
            channelId,
            Permissions.USE_GROUP_MENTIONS,
        )) {
            return {data: []};
        }

        const config = getConfig(state);
        const isTimezoneEnabled = config.ExperimentalTimezone === 'true';

        if (isCustomGroupsEnabled(state)) {
            await dispatch(searchGroups({
                q: prefix,
                filter_allow_reference: true,
                page: 0,
                per_page: 60,
                include_member_count: true,
                include_channel_member_count: channelId,
                include_timezones: isTimezoneEnabled,
            }));
        }
        return {data: searchAssociatedGroupsForReferenceLocal(state, prefix, teamId, channelId)};
    };
}
