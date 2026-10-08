// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Locator, Page} from '@playwright/test';

import {expect} from '@mattermost/playwright-lib';

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

/**
 * Navigate to a team's configuration page from the Teams list and wait for it to load.
 */
export async function openTeamConfig(page: Page, teamDisplayName: string): Promise<void> {
    await page.goto('/admin_console/user_management/teams');
    await page.waitForLoadState('networkidle');

    const search = page.locator('input[placeholder*="Search" i]').first();
    await search.fill(teamDisplayName);
    await page.waitForTimeout(1000);

    const row = page.locator('.DataGrid_row').filter({hasText: teamDisplayName}).first();
    await row.waitFor({state: 'visible', timeout: 10000});
    await row.getByText('Edit').click();
    await page.waitForLoadState('networkidle');
}

/**
 * Search a policy DataGrid (modal or full page) and return the matching row.
 *
 * The PolicyList fires an unfiltered fetch on mount; we wait for that to land
 * before typing so our search isn't overwritten by the late-resolving initial
 * load (which would otherwise show the first page of unrelated policies).
 */
export async function findPolicyRow(scope: Page | Locator, policyName: string): Promise<Locator> {
    await scope
        .locator('.DataGrid_row')
        .first()
        .waitFor({state: 'visible', timeout: 15000})
        .catch(() => {
            // Empty list is fine — the search below will populate it.
        });
    await scope.locator('[data-testid="searchInput"]').fill(policyName);
    const row = scope.locator('.DataGrid_row').filter({hasText: policyName}).first();
    await expect(row).toBeVisible({timeout: 15000});
    return row;
}

export async function setToggle(page: Page, on: boolean): Promise<void> {
    const toggle = page.locator('[data-testid="policy-enforce-toggle-button"]');
    await toggle.waitFor({state: 'visible', timeout: 10000});
    const pressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (pressed !== on) {
        await toggle.click();
    }
}

// Raw fetch wrapper — returns status + body so tests can assert on both success and rejection
// without doFetch swallowing the error.
export async function addTeamMemberRaw(
    token: string | null,
    baseRoute: string,
    teamId: string,
    userId: string,
): Promise<{status: number; body: any}> {
    const res = await fetch(`${baseRoute}/teams/${teamId}/members`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({team_id: teamId, user_id: userId}),
    });
    let body: any = {};
    try {
        body = await res.json();
    } catch {
        // empty body is fine
    }
    return {status: res.status, body};
}

// Log in via raw REST to obtain the user's OWN session token, so a self-join can be
// attempted with the requesting user's session rather than the admin's (which would
// bypass the attribute gate). The token is returned in the response 'Token' header.
export async function loginRaw(baseRoute: string, loginId: string, password: string): Promise<string> {
    const res = await fetch(`${baseRoute}/users/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({login_id: loginId, password}),
    });
    return res.headers.get('Token') ?? '';
}

export async function switchTeamRulesMode(page: Page): Promise<void> {
    const toggle = page.getByTestId('team-rules-editor-mode-toggle');
    await expect(toggle).toBeEnabled({timeout: 60_000});
    await toggle.click();
}

export async function typeTeamRulesCel(page: Page, expression: string): Promise<void> {
    const panel = page.locator('#team_level_access_rules');
    await panel.locator('.monaco-editor').waitFor({state: 'visible', timeout: 10_000});
    await panel.locator('.monaco-editor .view-lines').click({force: true});
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(expression, {delay: 10});
}

export async function waitForTeamRulesValidation(page: Page, state: 'validated' | 'error'): Promise<void> {
    await expect(page.locator('#team_level_access_rules .cel-editor__status-bar')).toHaveAttribute(
        'data-validation-state',
        state,
        {timeout: 10_000},
    );
}
