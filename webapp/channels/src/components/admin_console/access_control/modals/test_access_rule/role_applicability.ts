// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

/**
 * Mirrors the backend draftAppliesToSubject helper. Used by the picker UI to
 * pre-filter users so authors can't add ones the policy wouldn't govern.
 *
 * Hierarchy semantics match the live PDP's RoleFallback / ChannelRoleFallback:
 *   - system_admin's chain is [system_admin, system_user]
 *   - system_user's chain is [system_user]
 *   - system_guest's chain is [system_guest]
 *   - channel_admin's chain is [channel_admin, channel_user]
 *   - channel_user's chain is [channel_user]
 *   - channel_guest's chain is [channel_guest]
 *
 * "draft applies to user" means targetRole is in the user's chain. So a
 * system_admin draft applies only to admin users; a system_user draft
 * applies to both admins (via fallback) and members.
 */
export type TargetScope = 'system' | 'channel';

const SYSTEM_ROLE_FALLBACK: Record<string, string> = {
    system_admin: 'system_user',
};

const CHANNEL_ROLE_FALLBACK: Record<string, string> = {
    channel_admin: 'channel_user',
};

/**
 * Build the role chain for a subject role, primary first.
 */
export function roleChain(role: string, scope: TargetScope): string[] {
    if (!role) {
        return [];
    }
    const fallbackMap = scope === 'system' ? SYSTEM_ROLE_FALLBACK : CHANNEL_ROLE_FALLBACK;
    const fallback = fallbackMap[role];
    return fallback ? [role, fallback] : [role];
}

/**
 * Returns true when the draft policy with `targetRole`/`scope` would govern a
 * subject whose own role is `subjectRole`. Empty `targetRole` means "no role
 * constraint" → always applies.
 */
export function draftRoleAppliesToSubjectRole(targetRole: string, scope: TargetScope, subjectRole: string): boolean {
    if (!targetRole) {
        return true;
    }
    if (!subjectRole) {
        return false;
    }
    return roleChain(subjectRole, scope).includes(targetRole);
}

/**
 * Pick the highest-precedence base system role from a space-separated tokens
 * string. Mirrors the backend `pickSystemRoleFromSubject` precedence:
 * system_admin > system_guest > system_user.
 *
 * Returns "" when no recognised role is present.
 */
export function pickSystemRoleFromTokens(roles: string): string {
    if (!roles) {
        return '';
    }
    const tokens = roles.split(/\s+/).filter(Boolean);
    if (tokens.includes('system_admin')) {
        return 'system_admin';
    }
    if (tokens.includes('system_guest')) {
        return 'system_guest';
    }
    if (tokens.includes('system_user')) {
        return 'system_user';
    }
    return '';
}

/**
 * Convenience: does the draft policy targeting `targetRole` (in the given
 * scope) apply to this user? Looks at the user's stored .roles tokens.
 *
 * Channel-scope filtering also requires channel-membership context (the
 * caller passes `channelMemberRole` from the picker's channel-member lookup);
 * pass undefined when scope is 'system'.
 */
export function userMatchesTargetRole(
    user: Pick<UserProfile, 'roles'>,
    targetRole: string,
    scope: TargetScope,
    channelMemberRole?: string,
): boolean {
    if (scope === 'channel') {
        return draftRoleAppliesToSubjectRole(targetRole, 'channel', channelMemberRole ?? '');
    }
    return draftRoleAppliesToSubjectRole(targetRole, 'system', pickSystemRoleFromTokens(user.roles));
}

/**
 * Returns the set of channel-role tokens that should be passed to
 * /users/search via `channel_roles` so the result set is pre-filtered to
 * subjects governable by the draft rule.
 *
 * Inverse of the chain above: for a target T, return every concrete
 * subject role R such that `draftRoleAppliesToSubjectRole(T, 'channel', R)`
 * is true.
 *
 *   - target=channel_admin → [channel_admin]   (admin draft only governs admins)
 *   - target=channel_user  → [channel_user, channel_admin]
 *                            (admin chain falls back to user; user-targeted
 *                             rule governs both admins and members)
 *   - target=channel_guest → [channel_guest]   (guest lane is isolated)
 *   - target=""            → []                (no constraint)
 */
export function channelRolesMatchingTarget(targetRole: string): string[] {
    if (!targetRole) {
        return [];
    }
    const candidates = ['channel_admin', 'channel_user', 'channel_guest'];
    return candidates.filter((subject) => draftRoleAppliesToSubjectRole(targetRole, 'channel', subject));
}
