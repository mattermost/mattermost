// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, getRandomId, testConfig} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {setupCustomProfileAttributeValuesForUser} from '../../../channels/custom_profile_attributes/helpers';
import {
    createPermissionPolicy,
    deletePermissionPolicyByName,
    ensureUserAttributes,
    getPolicyIdByName,
    getUserAttributeFieldByName,
} from '../support';

/**
 * Require a feature flag to be on, in whichever mode the suite is running.
 *
 * FeatureFlags cannot be changed on a running server — with no Split key configured the
 * config store's readOnlyFF handling reverts a FeatureFlags patch before it is persisted,
 * so /config/patch returns 200 and changes nothing. Only a boot-time MM_FEATUREFLAGS_*
 * env var takes effect.
 *
 * In testcontainers mode ensureFeatureFlag restarts the server with the flag set, which is
 * why these flags do not need adding to SERVER_ENV_BASELINE. Against an external server
 * there is nothing to restart, and ensureFeatureFlag skips unconditionally there — even
 * when the flag is already on — so check-and-skip is the best available, and a dev server
 * booted with the flag still runs the tests.
 */
export async function requireFeatureFlag(pw: PlaywrightExtended, name: string): Promise<void> {
    if (testConfig.useTestContainers) {
        await pw.ensureFeatureFlag(name, true);
    } else {
        await pw.skipIfFeatureFlagNotSet(name, true);
    }
}

/**
 * Department value the grant policy matches on. Arbitrary, but distinct enough that no
 * other spec's policy is likely to key off it.
 */
export const BOR_ALLOWED_DEPARTMENT = 'BurnOnReadAllowed';

/**
 * A CEL expression no user can satisfy, so the policy denies everyone. Lets these specs
 * revoke access from a single user without provisioning two users with differing
 * attributes — the revocation is what is under test, not attribute matching.
 */
export const DENY_ALL_CEL = "user.email == 'no-such-user@nowhere.invalid'";

/**
 * Grant to exactly one user, keyed on their email.
 *
 * user.email is a native field on the subject (model.Subject.Email, populated by
 * BuildAccessControlSubject) rather than a custom profile attribute, so a policy using it
 * needs no attribute provisioning and compiles on any server. user.attributes.* would
 * require the named CPA field to exist first — a dependency worth avoiding when what is
 * under test is the burn-on-read action, not attribute plumbing. Emails are unique per
 * user, so this matches one user and no other.
 */
export function grantToEmailCEL(email: string): string {
    return `user.email == '${email}'`;
}

/** Turn burn-on-read on, and block until the server agrees. */
export async function ensureBurnOnReadEnabled(adminClient: Client4): Promise<void> {
    // Re-applied on every poll attempt, not sent once: specs share one server, and another
    // spec's concurrent pw.initSetup() can reset this value between our patch and the read
    // that confirms it (the same re-apply-guard race worked around in
    // self_deleting_messages.spec.ts).
    await expect
        .poll(
            async () => {
                await adminClient.patchConfig({
                    ServiceSettings: {
                        EnableBurnOnRead: true,
                        BurnOnReadDurationSeconds: 600,
                        BurnOnReadMaximumTimeToLiveSeconds: 3600,
                    },
                } as any);
                const cfg = await adminClient.getConfig();
                return cfg.ServiceSettings?.EnableBurnOnRead === true;
            },
            {timeout: 15000, intervals: [500, 1000, 2000]},
        )
        .toBe(true);
}

/**
 * Every initSetup() rewrites the shared server config, so an earlier spec can leave ABAC
 * off. Re-assert it immediately before the interaction that depends on it, or the policy
 * is created and never enforced and the allow-side assertions pass blindly.
 */
export async function ensureABACEnabled(adminClient: Client4): Promise<void> {
    await adminClient.patchConfig({
        AccessControlSettings: {EnableAttributeBasedAccessControl: true},
    } as any);

    await expect
        .poll(
            async () => {
                const cfg = await adminClient.getConfig();
                return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
            },
            {timeout: 15000, intervals: [500, 1000, 2000]},
        )
        .toBe(true);
}

/**
 * Create a deny-everyone burn-on-read policy through the System Console, i.e. revoke the
 * action from a user who currently holds it. Returns the policy name so the caller can
 * delete it in afterEach.
 */
export async function revokeBurnOnRead(page: Page, adminClient: Client4): Promise<string> {
    await ensureUserAttributes(adminClient, ['Department']);

    const policyName = `BoR Deny ${getRandomId()}`;
    await createPermissionPolicy(page, {
        name: policyName,
        celExpression: DENY_ALL_CEL,
        permissions: ['Create Burn-on-Read Message'],
        adminClient,
    });

    await expect
        .poll(async () => Boolean(await getPolicyIdByName(adminClient, policyName, 1)), {
            timeout: 30000,
            intervals: [500, 1000, 2000],
        })
        .toBe(true);

    return policyName;
}

/** Safe to call with an empty name, so afterEach needs no conditional. */
export async function cleanupPolicy(adminClient: Client4, policyName: string): Promise<void> {
    if (policyName) {
        await deletePermissionPolicyByName(adminClient, policyName);
    }
}

/**
 * Read the stored type of a scheduled post, matched by message, straight from the API.
 * Revoking access withdraws controls but must not rewrite the record, and that is the
 * difference this tells apart: presentation changed, or data changed.
 * Returns undefined when no such scheduled post exists.
 */
export async function getStoredScheduledPostType(
    client: Client4,
    teamId: string,
    message: string,
): Promise<string | undefined> {
    const byChannel = (await client.getScheduledPosts(teamId, true)).data;
    for (const posts of Object.values(byChannel ?? {})) {
        const match = (posts as any[]).find((p) => p.message === message);
        if (match) {
            return match.type;
        }
    }
    return undefined;
}

/**
 * The Department field, keyed the way createUserForABAC and
 * setupCustomProfileAttributeValuesForUser want it: by field ID, not by name. Both iterate
 * the map's entries and use the KEY as the field id, so a name-keyed map sends
 * "Department" as an id and the PATCH fails with
 * api.property_value.patch.invalid_field_id.app_error.
 *
 * Creates the field first. getUserAttributeFieldByName throws rather than creating, and a
 * concurrent spec's cleanup can delete every CPA field between runs.
 */
export async function departmentFieldsMap(adminClient: Client4): Promise<Record<string, UserPropertyField>> {
    await ensureUserAttributes(adminClient, ['Department']);
    const departmentField = await getUserAttributeFieldByName(adminClient, 'Department');
    return {[departmentField.id]: departmentField};
}

/**
 * Set one user's Department attribute, the value grantBurnOnRead's expression matches on.
 * Split out so a spec can provision a user the grant policy deliberately does NOT match.
 */
export async function setDepartment(adminClient: Client4, user: UserProfile, value: string): Promise<void> {
    await setupCustomProfileAttributeValuesForUser(
        adminClient,
        [{name: 'Department', type: 'text', value}],
        await departmentFieldsMap(adminClient),
        user.id,
    );
}

/**
 * Grant burn-on-read to one user, and block until the policy is readable.
 *
 * A grant is needed at all because of how the permission lane resolves: once ANY policy
 * governs create_burn_on_read_post, a role with no matching rule is denied rather than
 * implicitly allowed. So on a server that already carries a burn-on-read policy, the
 * control is hidden until a rule matches this user — "no policy" and "granted" are not
 * the same starting state.
 *
 * Sets the user's Department attribute and writes a policy matching that value, rather
 * than an always-true expression: a constant is not reliably accepted by the CEL editor,
 * and attribute matching is what the feature is actually for.
 *
 * NOTE: rules for the same role are AND'd together, so this grant cannot override a
 * pre-existing deny policy on system_user. If the control stays hidden after calling
 * this, look for another policy governing the action before suspecting the grant.
 */
export async function grantBurnOnRead(page: Page, adminClient: Client4, user: UserProfile): Promise<string> {
    await setDepartment(adminClient, user, BOR_ALLOWED_DEPARTMENT);

    const policyName = `BoR Allow ${getRandomId()}`;
    await createPermissionPolicy(page, {
        name: policyName,
        celExpression: `user.attributes.Department == '${BOR_ALLOWED_DEPARTMENT}'`,
        permissions: ['Create Burn-on-Read Message'],
        adminClient,
    });

    await expect
        .poll(async () => Boolean(await getPolicyIdByName(adminClient, policyName, 1)), {
            timeout: 30000,
            intervals: [500, 1000, 2000],
        })
        .toBe(true);

    return policyName;
}

/**
 * The action every policy in these specs governs.
 */
export const BOR_ACTION = 'create_burn_on_read_post';

/**
 * Create or replace a system-scoped permission policy over the API.
 *
 * createPermissionPolicy (abac/support.ts) drives the System Console instead, which means
 * the Monaco CEL editor — the most fragile dependency in the ABAC suite, and one that has
 * to be re-driven from scratch for every expression change. These specs are about
 * enforcement, not authoring: the editor is already covered by the jest tests on both
 * policy editors and by the UI-authoring specs. Going through the API also makes
 * re-authoring mid-test a single call.
 *
 * Pass an existing id to replace that policy in place rather than create a second one;
 * two policies governing the same action would be AND'd and the second would never be
 * able to widen the first.
 */
export async function upsertSystemPolicy(
    adminClient: Client4,
    options: {name: string; expression: string; id?: string; role?: string},
): Promise<string> {
    const saved: any = await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify({
            id: options.id ?? '',
            name: options.name,
            type: 'permission',
            active: true,
            revision: 1,
            version: 'v0.3',

            // v0.3 accepts exactly one system role on a permission policy.
            roles: [options.role ?? 'system_user'],
            imports: [],
            rules: [{actions: [BOR_ACTION], expression: options.expression}],
            props: {},
        }),
    });
    return saved.id;
}

/**
 * Create or replace the channel-scoped policy pinned to one channel.
 *
 * Channel policies are keyed by the channel id, so there is no separate assignment step —
 * policy.id IS the channel. The channel must be eligible: default, DM, GM,
 * group-constrained and shared channels are all rejected by
 * ValidateChannelEligibilityForAccessControl, so pass a private channel.
 *
 * The rule carries a name and a channel role because the enterprise policy store bumps a
 * channel policy to v0.4 as soon as one of its rules names a permission action, and v0.4
 * requires both (model/access_policy.go, accessPolicyVersionV0_4).
 */
export async function upsertChannelPolicy(
    adminClient: Client4,
    options: {channelId: string; expression: string; ruleName?: string; role?: string},
): Promise<string> {
    const saved: any = await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify({
            id: options.channelId,
            name: '',
            type: 'channel',
            active: true,
            revision: 1,
            version: 'v0.3',
            roles: [],
            imports: [],
            rules: [
                {
                    actions: [BOR_ACTION],
                    expression: options.expression,
                    name: options.ruleName ?? 'Burn-on-read',
                    role: 'channel_user',
                },
            ],
            props: {},
        }),
    });
    return saved.id;
}

/** Safe to call with an empty id, so afterEach needs no conditional. */
export async function deletePolicyById(adminClient: Client4, policyId: string): Promise<void> {
    if (!policyId) {
        return;
    }
    try {
        await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/access_control_policies/${policyId}`, {
            method: 'DELETE',
        });
    } catch {
        // Already gone, or never created — afterEach must not fail on cleanup.
    }
}

/**
 * Schedule a post over the API rather than through the schedule-message modal.
 *
 * The modal offers half-hour slots, while the server accepts any time down to 5s in the
 * past (scheduledPostMaxTimeGap). That is what lets a test schedule a post a few seconds
 * out and watch it fire, instead of picking a slot far enough away that the job could
 * never reach it during the run.
 *
 * Issued from inside the page rather than from a Client4 built in the test process, so the
 * request carries the same authenticated browser session a real client would use rather
 * than a separate one created for the test.
 *
 * Returns the status so callers can assert a rejection as well as a success.
 */
export async function scheduleBurnOnReadPostInPage(
    page: Page,
    options: {channelId: string; message: string; scheduledAt: number},
): Promise<{status: number; body: any}> {
    return page.evaluate(async ({channelId, message, scheduledAt}) => {
        const resp = await fetch('/api/v4/posts/schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                channel_id: channelId,
                message,
                scheduled_at: scheduledAt,
                type: 'burn_on_read',
            }),
        });
        const body = await resp.json().catch(() => ({}));
        return {status: resp.status, body};
    }, options);
}
