// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {PropertyField} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {General, Permissions} from 'mattermost-redux/constants';
import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';

const POST_OBJECT_TYPE = 'post';

/**
 * Whether the current user may write a value for a post-object `field` on
 * a `post`. Any other `object_type` is denied outright.
 *
 * A plain function rather than a hook: the edit modal calls it once per row
 * while mapping over a list whose length changes, and a hook would force a
 * fixed call order that list cannot guarantee. `isChannelPropertyAdmin` below
 * is the selector that produces the last argument; read it once per modal, not
 * once per row.
 *
 * This only decides whether to *draw* the control. The server re-checks every
 * write in `SessionHasPermissionToSetPropertyFieldValues`
 * (`app/authorization.go:535-546`), so the answer here is advisory.
 */
export function canEditPostAttributeValue(
    field: PropertyField,
    post: Post,
    currentUserId: string,
    isSystemAdmin: boolean,
    isChannelPropertyAdmin: boolean,
): boolean {
    if (field.object_type !== POST_OBJECT_TYPE) {
        return false;
    }

    switch (field.permission_values) {
    case 'member':
        return true;

    case 'creator':
        return isSystemAdmin || isChannelPropertyAdmin || post.user_id === currentUserId;

    case 'admin':
        return isSystemAdmin || isChannelPropertyAdmin;

    case 'sysadmin':
        return isSystemAdmin;

    default:
        return false;
    }
}

/**
 * Whether the current user counts as an admin over `channel` for the purposes
 * of a channel-scoped property field. Mirrors `hasChannelPropertyAdmin`
 * (`app/authorization.go`) step for step.
 */
export function isChannelPropertyAdmin(state: GlobalState, channel: Channel): boolean {
    if (haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_CHANNEL_ROLES)) {
        return true;
    }

    if (channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL) {
        return false;
    }

    if (!getMyChannelMember(state, channel.id)) {
        return false;
    }

    return !isCurrentUserGuestUser(state);
}
