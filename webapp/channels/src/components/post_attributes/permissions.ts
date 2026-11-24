// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {PropertyField, PropertyPermissionLevel} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {General, Permissions} from 'mattermost-redux/constants';
import {POST_OBJECT_TYPE} from 'mattermost-redux/constants/properties';
import {getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUser, isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';

/**
 * Whether the current user may write a value for a post-object `field` on
 * a `post`. Any other `object_type` is denied outright.
 *
 * The value.write tier comes from `field.permissions` when the field has it,
 * and from the legacy `permission_values` otherwise. A value.write grant naming
 * the current user, or one of their system roles, admits the write whatever the
 * tier says, as the server's `decidePropertyFieldPermission` does.
 * `currentUserRoles` is the space-separated `roles` of the current user's
 * profile: the server matches role grants against those roles only, not team
 * or channel roles.
 *
 * A plain function rather than a hook: the edit modal calls it once per row
 * while mapping over a list whose length changes, and a hook would force a
 * fixed call order that list cannot guarantee. `isChannelPropertyAdmin` below
 * is the selector that produces the `isChannelPropertyAdmin` argument; read it
 * once per modal, not once per row.
 *
 * This only decides whether to *draw* the control. The server re-checks every
 * write in `SessionHasPermissionToSetPropertyFieldValues`
 * (`app/authorization.go:535-546`), so the answer here is advisory.
 */
export function canEditPostAttributeValue(
    field: PropertyField,
    post: Post,
    currentUserId: string,
    currentUserRoles: string,
    isSystemAdmin: boolean,
    isChannelPropertyAdmin: boolean,
): boolean {
    if (field.object_type !== POST_OBJECT_TYPE) {
        return false;
    }

    const tier = field.permissions ? field.permissions.restrictions?.value.write : field.permission_values;
    if (tierAllowsValueWrite(tier, post, currentUserId, isSystemAdmin, isChannelPropertyAdmin)) {
        return true;
    }

    return hasValueWriteGrant(field, currentUserId, currentUserRoles);
}

function tierAllowsValueWrite(
    tier: PropertyPermissionLevel | undefined,
    post: Post,
    currentUserId: string,
    isSystemAdmin: boolean,
    isChannelPropertyAdmin: boolean,
): boolean {
    switch (tier) {
    case 'everyone':
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

// Mirrors `MatchingGrant` with no scope: a grant carrying scopes never applies
// to a value write.
function hasValueWriteGrant(field: PropertyField, currentUserId: string, currentUserRoles: string): boolean {
    const grants = field.permissions?.grants;
    if (!grants?.length || !currentUserId) {
        return false;
    }

    const roles = new Set(currentUserRoles.split(' ').filter(Boolean));

    return grants.some((grant) => {
        if (grant.scopes?.length || !grant.allow.includes('value.write')) {
            return false;
        }

        switch (grant.type) {
        case 'user':
            return grant.id === currentUserId;
        case 'role':
            return roles.has(grant.id);
        default:
            return false;
        }
    });
}

/**
 * The current user's system roles, space-separated, in the form
 * `canEditPostAttributeValue` takes. Team and channel roles are left out on
 * purpose: the server matches role grants against the user's own roles only
 * (`propertyCallerRoles`, `app/property_field_permissions.go`).
 */
export function getCurrentUserSystemRoles(state: GlobalState): string {
    return getCurrentUser(state)?.roles ?? '';
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
