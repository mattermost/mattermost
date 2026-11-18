// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Locator, Page} from '@playwright/test';

import {openSystemConsoleSection, expect, type App} from '@mattermost/playwright-lib';

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

    let current: any;
    await expect
        .poll(
            async () => {
                current = await (client as any).doFetch(`${client.getBaseRoute()}/jobs/${jobId}`, {method: 'GET'});
                return current.status;
            },
            {
                message: 'access_control_team_sync job did not finish',
                timeout: timeoutMs,
                intervals: [pollIntervalMs],
            },
        )
        .toMatch(/^(success|warning|error)$/);

    if (current.status === 'error') {
        throw new Error(`access_control_team_sync job failed: ${JSON.stringify(current)}`);
    }
    return current.status;
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
export async function openTeamConfig(app: App, teamDisplayName: string): Promise<void> {
    await openSystemConsoleSection(app, 'user_management/teams');

    // Let the unfiltered first load land, so it can't overwrite the search results.
    const teams = app.admin.teams;
    await expect(await teams.rowList.first()).toBeVisible({timeout: 15_000});

    await teams.searchTextbox.fill(teamDisplayName);
    await expect(teams.searchTextbox).toHaveValue(teamDisplayName);

    const row = await teams.rowList.itemWith({text: teamDisplayName});
    await expect(row).toBeVisible({timeout: 15_000});
    await row.editLink.click();

    await expect(app.page).toHaveURL(/\/admin_console\/user_management\/teams\/[a-z0-9]+$/, {timeout: 15_000});
    // The generated header also holds actions; the heading has no separate member.
    await expect(app.admin.header.locator.getByText('Team Management', {exact: true})).toBeVisible({timeout: 15_000});
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
        // The policy chooser has no generated grid parts; use the supplied dialog to bound its native rows and search.
        .locator('.DataGrid_row')
        .first()
        .waitFor({state: 'visible', timeout: 15000})
        .catch(() => {
            // Empty list is fine — the search below will populate it.
        });
    // The policy chooser has no generated grid parts; use the supplied dialog to bound its native rows and search.
    await scope.locator('[data-testid="searchInput"]').fill(policyName);
    // The policy chooser has no generated grid parts; use the supplied dialog to bound its native rows and search.
    const row = scope.locator('.DataGrid_row').filter({hasText: policyName}).first();
    await expect(row).toBeVisible({timeout: 15000});
    return row;
}

export async function setToggle(app: App, on: boolean): Promise<void> {
    const toggle = app.admin.team.policyEnforce.container;
    await expect(toggle).toBeVisible({timeout: 10000});
    await toggle.set(on);
    if (on) {
        await expect(toggle).toBeOn();
    } else {
        await expect(toggle).not.toBeOn();
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
    // The rules mode toggle has no generated part; its DOM id identifies the control beside the Monaco editor.
    const toggle = page.getByTestId('team-rules-editor-mode-toggle');
    // The Monaco/CEL rules editor is a third-party widget without declared parts: addressed by its own classes inside the team rules panel.
    const editor = page.locator('#team_level_access_rules .monaco-editor');
    const wasCel = await editor.isVisible();
    await expect(toggle).toBeEnabled({timeout: 60_000});
    await toggle.click();
    if (wasCel) {
        await expect(editor).not.toBeVisible();
    } else {
        await expect(editor).toBeVisible();
    }
}

export async function typeTeamRulesCel(page: Page, expression: string): Promise<void> {
    // The report exposes no Monaco editing surface for these existing policy rules.
    const panel = page.locator('#team_level_access_rules');
    await panel.locator('.monaco-editor').waitFor({state: 'visible', timeout: 10_000});
    // Monaco exposes its editable textarea and rendered lines through native classes within the rules panel.
    const input = panel.locator('.monaco-editor textarea.inputarea');
    // Monaco exposes its editable textarea and rendered lines through native classes within the rules panel.
    await panel.locator('.monaco-editor .view-lines').click({force: true});
    await expect(input).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(input).toBeFocused();
    await page.keyboard.type(expression, {delay: 10});
    // The Monaco/CEL rules editor is a third-party widget without declared parts: addressed by its own classes inside the team rules panel.
    await expect
        .poll(async () => (await panel.locator('.monaco-editor .view-lines').innerText()).replace(/\s/g, ''))
        .toBe(expression.replace(/\s/g, ''));
}

export async function waitForTeamRulesValidation(page: Page, state: 'validated' | 'error'): Promise<void> {
    // Validation lives in the undeclared Monaco status bar, so retain the existing scoped assertion.
    await expect(page.locator('#team_level_access_rules .cel-editor__status-bar')).toHaveAttribute(
        'data-validation-state',
        state,
        {timeout: 10_000},
    );
}
