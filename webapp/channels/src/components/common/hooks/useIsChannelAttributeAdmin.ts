// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

/**
 * Whether the current user administers this channel's attributes. Unlike
 * useCanSetChannelAttributes this is per-channel rather than per-field: it decides
 * which attributes are *listed* in Channel Info, where an admin must see every one
 * of them to have any way of correcting a value, while a member sees only what the
 * channel actually holds.
 */
export default function useIsChannelAttributeAdmin(channelId: string): boolean {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);

    const canManageChannelRoles = useSelector((state: GlobalState) => (
        channel ? haveIChannelPermission(state, channel.team_id, channelId, Permissions.MANAGE_CHANNEL_ROLES) : false
    ));

    return isSystemAdmin || canManageChannelRoles;
}
