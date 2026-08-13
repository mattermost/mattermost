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
 * Whether the current user may change a given attribute's value on a channel.
 *
 * Mirrors the server's two gates rather than replacing them: the outer channel
 * permission, and the field's own permission_values tier evaluated against this
 * channel. The server stays authoritative — this only decides whether to offer
 * an affordance that would fail.
 *
 * attrs.editable is checked here too, so a locked attribute renders read-only
 * for everyone including admins. That is a display rule, not a permission: the
 * server rejects the write independently.
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

    return useCallback((field: PropertyField): boolean => {
        if (!channel || !isPropertyFieldEditable(field)) {
            return false;
        }

        // An empty tier means the server will apply its own default for the
        // object type, which for a channel field is member. Treating it as
        // member here keeps the affordance consistent with what the write will do.
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
