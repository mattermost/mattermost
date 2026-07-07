// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';

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
    [General.SYSTEM_ADMIN_ROLE]: General.SYSTEM_USER_ROLE,
};

const CHANNEL_ROLE_FALLBACK: Record<string, string> = {
    [General.CHANNEL_ADMIN_ROLE]: General.CHANNEL_USER_ROLE,
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
    if (tokens.includes(General.SYSTEM_ADMIN_ROLE)) {
        return General.SYSTEM_ADMIN_ROLE;
    }
    if (tokens.includes(General.SYSTEM_GUEST_ROLE)) {
        return General.SYSTEM_GUEST_ROLE;
    }
    if (tokens.includes(General.SYSTEM_USER_ROLE)) {
        return General.SYSTEM_USER_ROLE;
    }
    return '';
}

/**
 * Pick the highest-precedence channel role from a space-separated channel
 * member roles string (`ChannelMember.roles`). Mirrors the backend's
 * effective-role precedence: channel_admin > channel_guest > channel_user.
 *
 * Returns "" when no recognised channel role is present (e.g. a malformed
 * member record).
 */
export function pickChannelRoleFromTokens(roles: string): string {
    if (!roles) {
        return '';
    }
    const tokens = roles.split(/\s+/).filter(Boolean);
    if (tokens.includes(General.CHANNEL_ADMIN_ROLE)) {
        return General.CHANNEL_ADMIN_ROLE;
    }
    if (tokens.includes(General.CHANNEL_GUEST_ROLE)) {
        return General.CHANNEL_GUEST_ROLE;
    }
    if (tokens.includes(General.CHANNEL_USER_ROLE)) {
        return General.CHANNEL_USER_ROLE;
    }
    return '';
}

/**
 * Sysadmins act as effective channel admins on every channel via
 * system-role override, even when they aren't members of the channel
 * being edited. The picker must therefore admit them unconditionally,
 * separate from the per-member channel role filter (which would fail
 * for a sysadmin who isn't a channel member).
 */
export function userIsSystemAdmin(user: Pick<UserProfile, 'roles'>): boolean {
    return pickSystemRoleFromTokens(user.roles) === General.SYSTEM_ADMIN_ROLE;
}

/**
 * Convenience: does the draft policy targeting `targetRole` (in the given
 * scope) apply to this user? Looks at the user's stored .roles tokens.
 *
 * Channel-scope filtering also requires channel-membership context (the
 * caller passes `channelMemberRole` from the picker's channel-member lookup);
 * pass undefined when scope is 'system'.
 *
 * Cross-scope edge case: system-console permission policies are defined at
 * system scope but their rules carry channel-scoped role names
 * (channel_admin / channel_user / channel_guest), because permission
 * policies govern per-channel actions even though they live at the system
 * level. For these rules the picker has no channel context — the rule
 * applies to whichever channel the subject happens to be a member of at
 * evaluation time. We can't pre-filter without that context, so we
 * accept the user and let the server attach a `no_applicable_policy`
 * blame at simulate time for subjects the rule does not in fact govern.
 * This matches the behaviour for empty `targetRole` (no constraint).
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
    if (isChannelRole(targetRole)) {
        // System-scope picker, channel-scoped target role — no
        // chain to check. Defer to server-side applicability via
        // no_applicable_policy blame.
        return true;
    }
    return draftRoleAppliesToSubjectRole(targetRole, 'system', pickSystemRoleFromTokens(user.roles));
}

/**
 * Returns true when `role` is one of the v0.4 channel-scoped permission
 * roles (channel_admin / channel_user / channel_guest). Used by the
 * picker's role-applicability filter to identify the system-rule /
 * channel-role mismatch that triggers the "skip filtering" path above.
 */
export function isChannelRole(role: string): boolean {
    return role === General.CHANNEL_ADMIN_ROLE || role === General.CHANNEL_USER_ROLE || role === General.CHANNEL_GUEST_ROLE;
}

/**
 * Returns the set of channel-role tokens that match a target rule's
 * scope, expanded through the role-chain fallback semantics:
 *
 *   - target=channel_admin → [channel_admin]   (admin draft only governs admins)
 *   - target=channel_user  → [channel_user, channel_admin]
 *                            (admin chain falls back to user; user-targeted
 *                             rule governs both admins and members)
 *   - target=channel_guest → [channel_guest]   (guest lane is isolated)
 *   - target=""            → []                (no constraint)
 *
 * Currently NOT used by the simulate picker — passing this set as
 * /users/search's `channel_roles` parameter has a server-side
 * footgun: every channel_role branch in `applyMultiRoleFilters` adds
 * `AND Users.Roles NOT LIKE %system_admin%`, silently excluding
 * sysadmins from the result even when they ARE a channel member of
 * the channel under test. The picker therefore queries by
 * `in_channel_id` only and lets the simulator attribute
 * `no_applicable_policy` for subjects the rule doesn't govern. Kept
 * exported because the chain semantics are useful for any caller
 * that needs to reason about role applicability without the SQL
 * exclusion.
 */
export function channelRolesMatchingTarget(targetRole: string): string[] {
    if (!targetRole) {
        return [];
    }
    const candidates = [General.CHANNEL_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_GUEST_ROLE];
    return candidates.filter((subject) => draftRoleAppliesToSubjectRole(targetRole, 'channel', subject));
}
