// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Page} from '@playwright/test';

import {
    Api,
    App,
    Msg,
    expect,
    ignoreMissing,
    openSystemConsoleSection,
    systemConsolePath,
    waitForApi,
} from '@mattermost/playwright-lib';

type PolicyRow = ReturnType<App['policySelectionModal']['policies']['row']>;

/**
 * Removes what a test created, in the order policies, teams, users (users are deactivated: hard deletion needs server
 * config). Something a test already removed is skipped; any other failure is thrown, so a teardown that really fails
 * shows up instead of leaving data behind unnoticed. Team child policies are keyed by the team id, so pass the team
 * ids as `policyIds` too when a test may have given a team its own policy.
 */
export async function cleanUpCreated(
    client: Client4,
    created: {policyIds?: string[]; teamIds?: string[]; userIds?: string[]},
): Promise<void> {
    for (const id of created.policyIds ?? []) {
        // A test may leave the policy in a state the server refuses to remove: a rule with values hidden from the
        // admin, or attribute-based access switched off so the service is not running. Those two answers are skipped.
        await ignoreMissing(
            () => client.deleteAccessControlPolicy(id),
            ['app.pap.has_masked_values.app_error', 'app.pap.is_ready.app_error'],
        );
    }
    for (const id of created.teamIds ?? []) {
        await ignoreMissing(() => client.deleteTeam(id));
    }
    for (const id of created.userIds ?? []) {
        await ignoreMissing(() => client.updateUserActive(id, false));
    }
}

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
    await expect(teams.rowList).not.toHaveKeyCount(0, {timeout: 15_000});

    await teams.searchTextbox.fill(teamDisplayName);
    await expect(teams.searchTextbox).toHaveValue(teamDisplayName);

    const teamId = await teams.rowList.keyWith({text: teamDisplayName}, {timeout: 15_000});
    const row = teams.row(teamId);
    await expect(row).toBeVisible();
    await row.editLink.click();

    await expect(app.page).toHavePath(systemConsolePath(`user_management/teams/${teamId}`), {timeout: 15_000});
    // The Team Management panel's title has no test id; its toggles do. One of them shows once the panel has loaded:
    // the anyone-can-join toggle is hidden for a synced team, and the policy toggle is only there with ABAC.
    const {team} = app.admin;
    await expect(team.allowAll.container.locator.or(team.policyEnforce.container.locator)).not.toHaveCount(0, {
        timeout: 15_000,
    });
}

/**
 * Search a policy DataGrid (modal or full page) and return the matching row.
 *
 * The PolicyList fires an unfiltered fetch on mount; we wait for that to land
 * before typing so our search isn't overwritten by the late-resolving initial
 * load (which would otherwise show the first page of unrelated policies).
 */
export async function findPolicyRow(app: App, policyName: string): Promise<PolicyRow> {
    const {page} = app;
    const policies = app.policySelectionModal.policies;
    await expect(policies.container).toBeVisible({timeout: 15_000});
    // DataGrid renders the loading message in its generated rows scope until the initial fetch has landed.
    await expect(policies.rows).not.toContainMessage(Msg.admin.data_grid.loading, undefined, {timeout: 15_000});
    await expect(policies.searchTextbox).toBeVisible();

    // The dialog opens with an empty search box, so filling the name always changes it and fires a request.
    await Promise.all([waitForApi(page, Api.SearchAccessControlPolicies), policies.searchTextbox.fill(policyName)]);
    await expect(policies.searchTextbox).toHaveValue(policyName);
    await expect(policies.rows).not.toContainMessage(Msg.admin.data_grid.loading, undefined, {timeout: 15_000});

    // A search term can match multiple policy names; resolve the generated row ID from its exact name cell.
    let matchingKey: string | undefined;
    await expect
        .poll(
            async () => {
                const keys = await policies.rowList.keys();
                const names = await Promise.all(
                    keys.map((key) => policies.row(key).cell('name').locator.textContent()),
                );
                matchingKey = keys[names.indexOf(policyName)];
                return matchingKey !== undefined;
            },
            {timeout: 15_000},
        )
        .toBe(true);
    if (matchingKey === undefined) {
        throw new Error(`Policy row not found: ${policyName}`);
    }
    const row = policies.row(matchingKey);
    await expect(row).toBeVisible({timeout: 15_000});
    await expect(row.cell('name')).toHaveText(policyName);
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
    // A rejection or a bodiless response may have no JSON to read.
    const text = await res.text();
    return {status: res.status, body: text ? JSON.parse(text) : {}};
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

/** Switches the team rules editor from Simple (the table) to Advanced (the CEL editor). */
export async function switchTeamRulesToAdvanced(page: Page): Promise<void> {
    const rules = new App(page).admin.team.accessRules;
    await expect(rules.switchModeButton).toBeEnabled({timeout: 60_000});
    await rules.switchModeButton.click();
    await expect(rules.rules.input).toBeVisible();
}

export async function typeTeamRulesCel(page: Page, expression: string): Promise<void> {
    const rules = new App(page).admin.team.accessRules.rules;
    await expect(rules.input).toBeVisible({timeout: 10_000});
    // Monaco owns its native textbox and rendered lines; scope both to the generated CELEditor input.
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- Monaco's own editing textarea cannot take a test id
    const input = rules.input.locator.getByRole('textbox');
    await input.focus();
    await expect(input).toBeFocused();
    await input.press('ControlOrMeta+a');
    await expect(input).toBeFocused();
    // Pace input so Monaco's paired brackets and quotes are overtyped rather than duplicated.
    await input.type(expression, {delay: 10});
    await expect
        .poll(async () =>
            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- Monaco renders its text in internal .view-lines elements, which cannot take a test id
            (await rules.input.locator.locator('.view-lines').innerText()).replace(/\s/g, ''),
        )
        .toBe(expression.replace(/\s/g, ''));
}

export async function waitForTeamRulesValidation(page: Page, state: 'validated' | 'error'): Promise<void> {
    const rules = new App(page).admin.team.accessRules.rules;
    await expect(rules.statusBarGroup).toHaveAttribute('data-validation-state', state, {timeout: 10_000});
}
