// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Lean helpers for the public-channel ABAC E2E specs.
 *
 * Design rules:
 *   - Reuse the existing primitives in `../team_settings/helpers.ts` for
 *     channel/policy/user creation and configuration. This file only adds
 *     thin wrappers that register cleanup as resources are created.
 *   - All test-created resources are tracked in a `CleanupLedger`. The spec's
 *     `test.afterEach` drains the ledger so resources are removed whether the
 *     test passed, failed, or threw mid-flight.
 *   - Cleanup is best-effort: individual failures are swallowed so one stale
 *     resource cannot block deletion of the others or mask the test result.
 *   - Custom profile attributes are scoped per test (unique names + cleanup).
 *     Tests must not lean on a shared `Department` field — the server caps CPA
 *     fields at 20, and accumulating shared state has historically saturated
 *     that limit and broken every subsequent run.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {newTestPassword, getRandomId} from '@mattermost/playwright-lib';

import {assignChannelsToPolicy, deletePolicy, unassignChannelsFromPolicy} from '../team_settings/helpers';

export type CleanupTask = () => Promise<unknown>;

export class CleanupLedger {
    private tasks: CleanupTask[] = [];

    add(task: CleanupTask): void {
        // LIFO: latest registrations run first so deletions respect dependency
        // order (e.g. unassign channels from a policy before deleting the policy).
        this.tasks.unshift(task);
    }

    async drain(): Promise<void> {
        const tasks = this.tasks;
        this.tasks = [];
        for (let i = 0; i < tasks.length; i++) {
            try {
                await tasks[i]();
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                const stack = e instanceof Error ? e.stack : undefined;
                // eslint-disable-next-line no-console
                console.error(`CleanupLedger.drain: cleanup task ${i} failed`, message, stack ?? '');
                // Swallow — cleanup is best-effort and must not mask the test
                // result or stop subsequent cleanups from running.
            }
        }
    }
}

/**
 * Issue a server request and surface the response body on non-2xx so the test
 * report shows *what* the server rejected, not just "failed". The shipped
 * helpers in `team_settings/helpers.ts` swallow these — useful in steady
 * state, brutal when something legitimately broke (e.g. CPA field-limit
 * exhaustion silently masquerading as a "field not found" error).
 */
async function doFetchOrThrow(client: Client4, url: string, init: RequestInit & {body?: string}): Promise<any> {
    const response = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${client.getToken()}`,
            ...(init.headers || {}),
        },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`${init.method} ${url} -> ${response.status}: ${text}`);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

/**
 * Permanently delete a user via the admin API.
 * Permanent deletion requires `ServiceSettings.EnableAPIUserDeletion` to be on
 * server-side; on test deployments where it is off, the call returns 4xx and
 * the cleanup ledger silently swallows it.
 */
export async function permanentDeleteUser(client: Client4, userId: string): Promise<void> {
    await (client as any).doFetch(`${client.getBaseRoute()}/users/${userId}?permanent=true`, {
        method: 'DELETE',
    });
}

/**
 * Create a per-test custom profile attribute (text type) with a unique name and
 * register cleanup. Returns the field including its server-assigned `id`,
 * which callers can plug straight into a CEL expression via
 * `user.attributes.id_<id>`.
 *
 * Avoids the shared `Department` slot used by other ABAC tests: those compete
 * for one of 20 server-cap'd CPA slots and any leak (a failed test, an
 * abandoned run) cascades into "field not found" or "limit reached" errors
 * across the whole suite.
 */
export async function createTrackedAttribute(
    client: Client4,
    baseName: string,
    ledger: CleanupLedger,
): Promise<{id: string; name: string}> {
    const name = `${baseName}_${getRandomId()}`;
    const field = await doFetchOrThrow(client, `${client.getBaseRoute()}/custom_profile_attributes/fields`, {
        method: 'POST',
        body: JSON.stringify({name, type: 'text', attrs: {visibility: 'when_set'}}),
    });
    ledger.add(() =>
        doFetchOrThrow(client, `${client.getBaseRoute()}/custom_profile_attributes/fields/${field.id}`, {
            method: 'DELETE',
        }),
    );
    return {id: field.id, name: field.name};
}

/**
 * Set a CPA value on a user, addressing the field by its ID. Avoids the
 * field-name-to-ID lookup in the shared `setUserAttribute` helper, which is
 * unnecessary indirection now that callers hold the field handle directly.
 */
export async function setUserAttributeById(client: Client4, userId: string, fieldId: string, value: string) {
    await client.updateUserCustomProfileAttributesValues(userId, {[fieldId]: value});
}

/**
 * Create a public channel and register cleanup for it.
 */
export async function createTrackedPublicChannel(client: Client4, teamId: string, ledger: CleanupLedger) {
    const id = getRandomId();
    const channel = await client.createChannel({
        team_id: teamId,
        name: `pub-${id}`,
        display_name: `PUB-${id}`,
        type: 'O',
    } as any);
    ledger.add(() => client.deleteChannel(channel.id));
    return channel;
}

/**
 * Create a parent ABAC policy with the given CEL rule and assign the given
 * channels in one shot. Registers cleanup so the policy (and its inherited
 * channel-scope children) gets removed even if the test bails partway.
 *
 * Why we don't reuse `createParentPolicy` from team_settings/helpers.ts and
 * patch afterwards: that helper hardcodes `expression: 'true'`, and a follow-up
 * PUT to override the rule fails the server's policy-validation pipeline.
 * Stamping the desired expression on the initial create is both simpler and
 * matches what the system console actually does.
 */
export async function createPolicyAssignedToChannels(
    client: Client4,
    name: string,
    expression: string,
    channelIds: string[],
    ledger: CleanupLedger,
) {
    const policy: any = await doFetchOrThrow(client, `${client.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify({
            id: '',
            name,
            type: 'parent',
            version: 'v0.2',
            revision: 0,
            rules: [{expression, actions: ['*']}],
        }),
    });

    // Cleanup is self-sufficient: unassign first, then delete. The LIFO drain
    // order in the spec runs this BEFORE the channel deletes, so the parent
    // still has live child-scope policy rows referencing it — DeleteAccessControlPolicy
    // would silently fail and leak the parent. Unassigning explicitly drops
    // those children regardless of channel cleanup order.
    ledger.add(async () => {
        if (channelIds.length > 0) {
            try {
                await unassignChannelsFromPolicy(client, policy.id, channelIds);
            } catch {
                // Channels may already be gone (their cleanup tasks may have run
                // first), in which case the child policies were auto-removed by
                // cleanupChannelAccessControlPolicy. Either way, best-effort.
            }
        }
        await deletePolicy(client, policy.id);
    });

    if (channelIds.length > 0) {
        await assignChannelsToPolicy(client, policy.id, channelIds);
    }

    return policy;
}

/**
 * Flip the auto-add (Active) flag on a channel-scope ABAC policy. Channel-scope
 * policies share the channel's ID, so this is keyed by channelId. Active=true
 * is what makes the access-control sync job auto-add matching users.
 *
 * Children inherit the parent's Active flag at assign time, but the parent
 * default on a fresh `createPolicyAssignedToChannels` is false — flip the
 * child here when the test needs auto-add ON.
 */
export async function setChannelPolicyActive(client: Client4, channelId: string, active: boolean): Promise<void> {
    await doFetchOrThrow(client, `${client.getBaseRoute()}/access_control_policies/activate`, {
        method: 'PUT',
        body: JSON.stringify({entries: [{id: channelId, active}]}),
    });
}

/**
 * Trigger an access-control sync job for a single policy and return the job
 * record. The job is queued — call `waitForJobCompletion` to block until it
 * resolves.
 */
export async function runAccessControlSyncJob(client: Client4, policyId: string): Promise<any> {
    return client.createJob({
        type: 'access_control_sync' as any,
        data: {policy_id: policyId},
    });
}

/**
 * Poll a job until it reaches a terminal status (success / error / canceled).
 * Sync jobs are queued and processed asynchronously; in CI the queue can be
 * idle for several seconds before pickup. The default 60s ceiling matches what
 * we've seen empirically; callers can extend via `timeoutMs` when running on
 * slow servers.
 */
export async function waitForJobCompletion(
    client: Client4,
    jobId: string,
    opts: {timeoutMs?: number; pollIntervalMs?: number} = {},
): Promise<any> {
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const pollIntervalMs = opts.pollIntervalMs ?? 1_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const job: any = await client.getJob(jobId);
        if (job.status === 'success') {
            return job;
        }
        if (job.status === 'error' || job.status === 'canceled') {
            const detail = job?.data?.message ?? job?.message ?? job?.error ?? JSON.stringify(job?.data ?? job);
            throw new Error(`Job ${jobId} finished with status ${job.status}: ${detail}`);
        }
        await new Promise((res) => setTimeout(res, pollIntervalMs));
    }
    throw new Error(`Job ${jobId} did not reach a terminal status within ${timeoutMs}ms`);
}

/**
 * Create a user, add them to a team, optionally set a single attribute by ID,
 * and bypass the tutorial / onboarding so tests can `pw.testBrowser.login()`
 * straight into the channels view. Cleanup is registered for the user.
 */
export async function createTrackedTeamMember(
    adminClient: Client4,
    teamId: string,
    attribute: {fieldId: string; value: string} | undefined,
    ledger: CleanupLedger,
): Promise<UserProfile & {password: string}> {
    const id = getRandomId();
    const username = `pub${id}`.toLowerCase();
    const password = newTestPassword();

    const user = await adminClient.createUser(
        {email: `${username}@sample.mattermost.com`, username, password} as UserProfile & {password: string},
        '',
        '',
    );
    ledger.add(() => permanentDeleteUser(adminClient, user.id));

    await adminClient.savePreferences(user.id, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding', name: 'complete', value: 'true'},
    ]);
    await adminClient.addToTeam(teamId, user.id);
    if (attribute) {
        await setUserAttributeById(adminClient, user.id, attribute.fieldId, attribute.value);
    }

    // Attach the password back to the user object so pw.testBrowser.login() can
    // authenticate — the API response does not include it.
    return {...user, password};
}
