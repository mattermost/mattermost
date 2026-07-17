// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

/**
 * Enable team-membership ABAC end to end: the umbrella attribute-based access
 * control setting plus the `TeamMembershipAccessControl` feature flag that gates
 * the per-team System Console section. Both must be on for the team page to
 * render the membership-policy toggle — mirroring the server enforcement gate.
 */
export async function enableTeamMembershipPolicies(client: Client4): Promise<void> {
    await client.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
        FeatureFlags: {
            TeamMembershipAccessControl: true,
        },
    } as any);
}

/**
 * Create a parent membership policy that can be assigned to a TEAM.
 *
 * Team assignment runs `child.Inherit(parent)` with the child at v0.3, which
 * requires the parent to also be v0.3 — so (unlike the channel-side
 * createParentPolicy, which is v0.2) this helper stamps v0.3 and a membership
 * action. Returns the created policy (carries `id` and `name`).
 */
export async function createTeamMembershipParentPolicy(
    client: Client4,
    name: string,
    expression: string,
): Promise<{id: string; name: string}> {
    return (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies`, {
        method: 'put',
        body: JSON.stringify({
            id: '',
            name,
            type: 'parent',
            version: 'v0.3',
            revision: 0,
            rules: [{expression, actions: ['membership']}],
        }),
    });
}

/**
 * Trigger an access_control_team_sync job and poll that specific job until it
 * finishes. Polling by ID (not list position) avoids a race where older jobs
 * occupy jobs[0] and the newly created one is never checked.
 *
 * Both `success` and `warning` are terminal completions: the worker reports
 * `warning` (not `success`) whenever the mass-removal guardrail trips — i.e. a
 * sync that drops >50% of a team. The sync still ran to completion, so callers
 * that exercise removals must accept it. The final status is returned so a
 * caller can assert on it (e.g. expecting the warning state).
 */
export async function triggerSyncJobAndPoll(
    client: Client4,
    policyId = '',
    timeoutMs = 90_000,
    pollIntervalMs = 3_000,
): Promise<string> {
    // Scope the sync to the team's policy (team policies are keyed by team id),
    // mirroring the product trigger createAccessControlTeamSyncJob({policy_id}).
    // A scoped sync also chains a scoped channel sync, so the chained job is
    // created deterministically rather than skipped by the unscoped dedupe.
    const body: {type: string; data?: {policy_id: string}} = {type: 'access_control_team_sync'};
    if (policyId) {
        body.data = {policy_id: policyId};
    }
    const job: any = await (client as any).doFetch(`${client.getBaseRoute()}/jobs`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    const jobId: string = job.id;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        const current: any = await (client as any).doFetch(`${client.getBaseRoute()}/jobs/${jobId}`, {method: 'GET'});
        if (current.status === 'success' || current.status === 'warning') {
            return current.status;
        }
        if (current.status === 'error') {
            throw new Error(`access_control_team_sync job failed: ${JSON.stringify(current)}`);
        }
    }
    throw new Error('Timed out waiting for access_control_team_sync job to finish');
}

/**
 * Assign a parent policy to teams via the REST API (the `team_ids` field).
 * Mirrors `assignChannelsToPolicy` from team_settings/helpers — same endpoint,
 * different resource list.
 */
export async function assignTeamsToPolicy(client: Client4, policyId: string, teamIds: string[]): Promise<void> {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/assign`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${client.getToken()}`},
        body: JSON.stringify({team_ids: teamIds}),
    });
    if (!response.ok) {
        throw new Error(`assignTeamsToPolicy failed: ${response.status}`);
    }
}
