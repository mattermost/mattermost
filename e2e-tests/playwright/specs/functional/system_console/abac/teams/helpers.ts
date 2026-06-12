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
 * reaches `success`. Polling by ID (not list position) avoids a race where
 * older jobs occupy jobs[0] and the newly created one is never checked.
 */
export async function triggerSyncJobAndPoll(
    client: Client4,
    timeoutMs = 90_000,
    pollIntervalMs = 3_000,
): Promise<void> {
    const job: any = await (client as any).doFetch(`${client.getBaseRoute()}/jobs`, {
        method: 'POST',
        body: JSON.stringify({type: 'access_control_team_sync'}),
    });
    const jobId: string = job.id;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        const current: any = await (client as any).doFetch(
            `${client.getBaseRoute()}/jobs/${jobId}`,
            {method: 'GET'},
        );
        if (current.status === 'success') {
            return;
        }
        if (current.status === 'error') {
            throw new Error(`access_control_team_sync job failed: ${JSON.stringify(current)}`);
        }
    }
    throw new Error('Timed out waiting for access_control_team_sync job to succeed');
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
