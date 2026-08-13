// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';

import {Permissions} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {isPropertyFieldEditable} from 'mattermost-redux/utils/property_utils';

import type {GlobalState} from 'types/store';

/**
 * Whether the current user may set an attribute's value on a channel. Mirrors the
 * server's permission_values tier rather than replacing it — the server stays
 * authoritative; this only decides whether to offer an affordance that would fail.
 *
 * attrs.editable means "may not be *changed* once set", so it is checked only
 * against an existing value: a locked attribute whose creation-time write failed
 * must stay fillable, or it is stranded as "Not set" forever. The server does not
 * consult the key at all, so that lock is advisory until it does.
 */
export default function useCanSetChannelAttributes(channelId: string) {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);

    const canManageChannelRoles = useSelector((state: GlobalState) => (
        channel ? haveIChannelPermission(state, channel.team_id, channelId, Permissions.MANAGE_CHANNEL_ROLES) : false
    ));

    const canReadChannel = useSelector((state: GlobalState) => (
        channel ? haveIChannelPermission(state, channel.team_id, channelId, Permissions.READ_CHANNEL) : false
    ));

    return useCallback((field: PropertyField, hasValue = false): boolean => {
        if (!channel) {
            return false;
        }

        // Locked only bites once there is a value to protect.
        if (hasValue && !isPropertyFieldEditable(field)) {
            return false;
        }

        // Empty means the server applies its default, which for a channel is member.
        switch (field.permission_values ?? '') {
        case 'none':
            return false;
        case 'sysadmin':
            return isSystemAdmin;
        case 'admin':
            return isSystemAdmin || canManageChannelRoles;
        case 'member':
        case '':
            return isSystemAdmin || canReadChannel;
        default:
            return false;
        }
    }, [channel, isSystemAdmin, canManageChannelRoles, canReadChannel]);
}
