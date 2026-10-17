// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Advanced (CEL) mode for the Team-specific membership rules editor on the
 *            System Console per-team page: authoring, validation, save, enforcement and sync.
 * @reference MM-71104
 */

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Page} from '@playwright/test';

import {
    ChannelsPage,
    expect,
    getAdminClient,
    getRandomId,
    newTestPassword,
    test,
    verifyUserInChannel,
} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    addAttributeRule,
    createPrivateChannel,
    createPrivateTeam,
    createPublicTeam,
    createTeamAdmin,
    createTeamMembershipPolicy,
    getTeamAccessControlPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {createUserAttributeField, testAccessRule} from '../support';

import {
    addTeamMemberRaw,
    assignTeamsToPolicy,
    createTeamMembershipParentPolicy,
    enableTeamMembershipPolicies,
    findPolicyRow,
    openTeamConfig,
    setToggle,
    switchTeamRulesMode,
    triggerSyncJobAndPoll,
    typeTeamRulesCel,
    waitForTeamRulesValidation,
} from './helpers';

// Run-unique text fields: other specs create Location/Department with other types.
const DEPT = `Dept${getRandomId()}`;
const LOC = `Loc${getRandomId()}`;

const orRule = () => `user.attributes.${LOC} == "US" || user.attributes.${LOC} == "EU"`;
const simpleRule = () => `user.attributes.${DEPT} == "Sales"`;
const engineeringRule = () => `user.attributes.${DEPT} == "Engineering"`;
const invalidRule = () => `user.attributes.${LOC} ==`;

type FixtureLabel = 'engUS' | 'engAPAC' | 'salesEU' | 'salesAPAC';

const FIXTURE_ATTRIBUTES: Record<FixtureLabel, {dept: string; loc: string}> = {
    engUS: {dept: 'Engineering', loc: 'US'},
    engAPAC: {dept: 'Engineering', loc: 'APAC'},
    salesEU: {dept: 'Sales', loc: 'EU'},
    salesAPAC: {dept: 'Sales', loc: 'APAC'},
};

test.describe('ABAC - Team Advanced membership rules', {tag: ['@abac', '@team_membership']}, () => {
    const fieldIds: string[] = [];
    const createdPolicyIds: string[] = [];
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        await enableTeamMembershipPolicies(adminClient);
        for (const name of [DEPT, LOC]) {
            const field = await createUserAttributeField(adminClient, name);
            fieldIds.push(field.id);
        }
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        for (const id of fieldIds.splice(0)) {
            await (adminClient as any)
                .doFetch(`${adminClient.getBaseRoute()}/custom_profile_attributes/fields/${id}`, {method: 'DELETE'})
                .catch(() => {});
        }
    });

    test.afterEach(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        const base = adminClient.getBaseRoute();
        const headers = {Authorization: `Bearer ${adminClient.getToken()}`};
        const teamIds = createdTeamIds.splice(0);

        // Team child policies are keyed by the team id.
        for (const id of [...teamIds, ...createdPolicyIds.splice(0)]) {
            await fetch(`${base}/access_control_policies/${id}`, {method: 'DELETE', headers}).catch(() => {});
        }
        for (const id of teamIds) {
            await adminClient.deleteTeam(id).catch(() => {});
        }
        for (const id of createdUserIds.splice(0)) {
            await adminClient.updateUserActive(id, false).catch(() => {});
        }
    });

    async function createFixtureUser(adminClient: Client4, label: string, dept: string, loc: string) {
        const username = `${label.toLowerCase()}${getRandomId()}`;
        const user = await adminClient.createUser(
            {email: `${username}@sample.mattermost.com`, username, password: newTestPassword()} as any,
            '',
            '',
        );
        createdUserIds.push(user.id);
        await setUserAttribute(adminClient, user.id, DEPT, dept);
        await setUserAttribute(adminClient, user.id, LOC, loc);
        return user;
    }

    // Waits for the attribute view to catch up; it lags behind attribute writes.
    async function setupFixture(
        pw: PlaywrightExtended,
        options: {members?: FixtureLabel[]; publicTeam?: boolean} = {},
    ): Promise<{adminClient: Client4; adminUser: UserProfile; team: Team; users: Record<FixtureLabel, UserProfile>}> {
        const {members = ['engUS', 'engAPAC', 'salesEU'], publicTeam = false} = options;

        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('TeamMembershipAccessControl', true);

        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        await enableTeamMembershipPolicies(adminClient);

        const suffix = pw.random.id();
        const team = publicTeam
            ? await createPublicTeam(adminClient, suffix)
            : await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // Keep the sysadmin creator out of the roster so it is never a sync casualty.
        await adminClient.removeFromTeam(team.id, adminUser.id).catch(() => {});

        const users = {} as Record<FixtureLabel, UserProfile>;
        for (const [label, attrs] of Object.entries(FIXTURE_ATTRIBUTES) as Array<
            [FixtureLabel, {dept: string; loc: string}]
        >) {
            users[label] = await createFixtureUser(adminClient, label, attrs.dept, attrs.loc);
        }
        for (const label of members) {
            await adminClient.addToTeam(team.id, users[label].id);
        }

        await waitForAttributeViewToInclude(adminClient, orRule(), [users.engUS.id, users.salesEU.id]);
        await waitForAttributeViewToInclude(adminClient, `user.attributes.${LOC} == "APAC"`, [
            users.engAPAC.id,
            users.salesAPAC.id,
        ]);
        await waitForAttributeViewToInclude(adminClient, engineeringRule(), [users.engUS.id, users.engAPAC.id]);
        await waitForAttributeViewToInclude(adminClient, simpleRule(), [users.salesEU.id, users.salesAPAC.id]);

        return {adminClient, adminUser, team, users};
    }

    async function openTeamRules(page: Page, team: Team) {
        const policyFetchDone = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: 20_000,
            })
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDone;
        await setToggle(page, true);

        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 15_000});
        return rulesPanel;
    }

    async function getMembershipExpression(adminClient: Client4, teamId: string): Promise<string | undefined> {
        const response: any = await getTeamAccessControlPolicy(adminClient, teamId).catch(() => null);
        return response?.policy?.rules?.find((rule: any) => rule.actions?.includes('membership'))?.expression;
    }

    async function getTeamMemberIds(adminClient: Client4, teamId: string): Promise<string[]> {
        const members = await adminClient.getTeamMembers(teamId, 0, 200);
        return members.filter((m) => m.delete_at === 0).map((m) => m.user_id);
    }

    async function clearMonaco(page: Page) {
        const panel = page.locator('#team_level_access_rules');
        await panel.locator('.monaco-editor .view-lines').click({force: true});
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Delete');
    }

    test('MM-71104-T1 toggle defaults to Simple and carries the rule across modes', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        await addAttributeRule(rulesPanel, page, 'Engineering', DEPT);

        const toggle = page.getByTestId('team-rules-editor-mode-toggle');
        await expect(toggle).toHaveText('Switch to Advanced Mode');

        await switchTeamRulesMode(page);
        await expect(rulesPanel.locator('.monaco-editor')).toBeVisible();
        await expect(rulesPanel.locator('.cel-editor')).toContainText(`user.attributes.${DEPT} == "Engineering"`);

        await expect(toggle).toHaveText('Switch to Simple Mode');
        await expect(toggle).toBeEnabled();
        await toggle.click();

        await expect(rulesPanel.locator('.values-editor__simple-input').first()).toHaveValue('Engineering');
    });

    test('MM-71104-T2 saves a valid Advanced OR rule on a private team', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');

        const jobResponse = page.waitForResponse(
            (resp) => resp.url().endsWith('/api/v4/jobs') && resp.request().method() === 'POST',
            {timeout: 30_000},
        );
        await page.getByTestId('saveSetting').click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await expect(confirmModal.getByText(/1 member does not currently meet/i)).toBeVisible();
        await confirmModal.getByRole('button', {name: 'Apply'}).click();

        const job = await (await jobResponse).json();
        expect(job.type).toBe('access_control_team_sync');
        expect(job.data?.policy_id).toBe(team.id);

        await expect.poll(() => getMembershipExpression(adminClient, team.id), {timeout: 15_000}).toBe(orRule());
    });

    test('MM-71104-T3 a saved complex rule opens in Advanced with Simple locked', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        await expect(rulesPanel.locator('.monaco-editor')).toBeVisible({timeout: 15_000});
        const toggle = page.getByTestId('team-rules-editor-mode-toggle');
        await expect(toggle).toHaveText('Switch to Simple Mode');
        await expect(toggle).toBeDisabled();
    });

    test('MM-71104-T4 a simple rule typed in Advanced can go back to Simple', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, simpleRule());
        await waitForTeamRulesValidation(page, 'validated');

        const toggle = page.getByTestId('team-rules-editor-mode-toggle');
        await expect(toggle).toBeEnabled();
        await toggle.click();

        await expect(rulesPanel.locator('.values-editor__simple-input').first()).toHaveValue('Sales');
    });

    test('MM-71104-T5 invalid CEL blocks Save and nothing is persisted, including a parent link', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const parentName = `Eng Parent ${pw.random.id()}`;
        const parent = await createTeamMembershipParentPolicy(adminClient, parentName, engineeringRule());
        createdPolicyIds.push(parent.id);

        const {page} = await pw.testBrowser.login(adminUser);
        await openTeamRules(page, team);

        await page.locator('[data-testid="link-to-a-policy"]').click();
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});
        const policyRow = await findPolicyRow(modal, parentName);
        await policyRow.click();
        await expect(
            page.locator('#team_access_control_with_policy').locator('.policy-name').filter({hasText: parentName}),
        ).toBeVisible({timeout: 5000});

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, invalidRule());
        await waitForTeamRulesValidation(page, 'error');

        await page.getByTestId('saveSetting').click();

        await expect(page.getByTestId('saveChangesPanel-errorMessage')).toContainText('Fix the errors');
        await expect(page.locator('.ConfirmModal')).toHaveCount(0);

        expect((await adminClient.getTeam(team.id)).policy_enforced).toBeFalsy();
        const response: any = await getTeamAccessControlPolicy(adminClient, team.id).catch(() => null);
        expect(response?.policy?.imports ?? []).not.toContain(parent.id);
    });

    test('MM-71104-T6 Save during the validation delay is still blocked', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, invalidRule());
        await page.getByTestId('saveSetting').click();

        await expect(page.getByTestId('saveChangesPanel-errorMessage')).toContainText('Fix the errors', {
            timeout: 10_000,
        });
        await expect(page.locator('.ConfirmModal')).toHaveCount(0);
        expect((await adminClient.getTeam(team.id)).policy_enforced).toBeFalsy();
        expect(await getMembershipExpression(adminClient, team.id)).toBeUndefined();
    });

    test('MM-71104-T7 resource attribute references are rejected', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, 'resource.attributes.Program == "x"');

        await expect(rulesPanel.locator('[role="alert"]').filter({hasText: 'resource attributes'})).toBeVisible();

        await page.getByTestId('saveSetting').click();
        await expect(page.getByTestId('saveChangesPanel-errorMessage')).toContainText('Fix the errors');
        await expect(page.locator('.ConfirmModal')).toHaveCount(0);
    });

    test('MM-71104-T8 session attribute references are rejected', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, 'user.session.ip == "1.2.3.4"');

        await expect(rulesPanel.locator('[role="alert"]').filter({hasText: 'session attributes'})).toBeVisible();

        await page.getByTestId('saveSetting').click();
        await expect(page.getByTestId('saveChangesPanel-errorMessage')).toContainText('Fix the errors');
        await expect(page.locator('.ConfirmModal')).toHaveCount(0);
    });

    test('MM-71104-T9 Test access rule in Advanced previews workspace-wide matches', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminUser, team, users} = await setupFixture(pw, {members: ['engUS', 'engAPAC']});

        const {page} = await pw.testBrowser.login(adminUser);
        await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');

        // salesEU is not a member, so a match proves the preview isn't scoped to the team.
        const result = await testAccessRule(page, {
            expectedMatchingUsers: [users.engUS.username, users.salesEU.username],
            expectedNonMatchingUsers: [users.engAPAC.username, users.salesAPAC.username],
        });
        expect(result.expectedUsersMatch).toBe(true);
        expect(result.unexpectedUsersMatch).toBe(false);
    });

    test('MM-71104-T10 join gate honors OR, returns the generic 403 and does not exempt admins', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, team, users} = await setupFixture(pw, {members: []});
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const base = adminClient.getBaseRoute();
        const token = adminClient.getToken();

        // * The second OR branch admits.
        const allowed = await addTeamMemberRaw(token, base, team.id, users.salesEU.id);
        expect(allowed.status).toBe(201);

        // * A non-qualifier gets the generic rejection with no policy details.
        const denied = await addTeamMemberRaw(token, base, team.id, users.salesAPAC.id);
        expect(denied.status).toBe(403);
        expect(denied.body.id).toBe('api.team.add_user.to.team.rejected');
        for (const leak of [LOC, '"US"', '"EU"']) {
            expect(denied.body.message).not.toContain(leak);
        }
        expect(denied.body.message).not.toMatch(/policy/i);

        // * A non-qualifying system admin is not exempt.
        const sysAPAC = await createFixtureUser(adminClient, 'sysapac', 'Engineering', 'APAC');
        await adminClient.updateUserRoles(sysAPAC.id, 'system_user system_admin');
        await waitForAttributeViewToInclude(adminClient, `user.attributes.${LOC} == "APAC"`, [sysAPAC.id]);
        const adminDenied = await addTeamMemberRaw(token, base, team.id, sysAPAC.id);
        expect(adminDenied.status).toBe(403);

        const memberIds = await getTeamMemberIds(adminClient, team.id);
        expect(memberIds).not.toContain(users.salesAPAC.id);
        expect(memberIds).not.toContain(sysAPAC.id);
    });

    test('MM-71104-T10b a grouped rule is enforced as written by both the join gate and sync', async ({pw}) => {
        test.setTimeout(240_000);
        const {adminClient, team, users} = await setupFixture(pw, {members: ['engUS', 'salesEU', 'salesAPAC']});

        // engUS passes the group but fails the AND; read as A || (B && C) it would be kept.
        const groupedRule = `(${orRule()}) && ${simpleRule()}`;
        await createTeamMembershipPolicy(adminClient, team.id, groupedRule, false);
        expect(await getMembershipExpression(adminClient, team.id)).toBe(groupedRule);

        // * Sync (SQL) keeps only the member matching both sides.
        await triggerSyncJobAndPoll(adminClient, team.id);
        await expect
            .poll(
                async () => {
                    const ids = await getTeamMemberIds(adminClient, team.id);
                    return {
                        engUS: ids.includes(users.engUS.id),
                        salesEU: ids.includes(users.salesEU.id),
                        salesAPAC: ids.includes(users.salesAPAC.id),
                    };
                },
                {timeout: 60_000},
            )
            .toEqual({engUS: false, salesEU: true, salesAPAC: false});

        // * The join gate (CEL) agrees.
        const salesUS = await createFixtureUser(adminClient, 'salesus', 'Sales', 'US');
        await waitForAttributeViewToInclude(adminClient, groupedRule, [salesUS.id]);
        const base = adminClient.getBaseRoute();
        const token = adminClient.getToken();
        expect((await addTeamMemberRaw(token, base, team.id, salesUS.id)).status).toBe(201);
        expect((await addTeamMemberRaw(token, base, team.id, users.engUS.id)).status).toBe(403);
        expect((await addTeamMemberRaw(token, base, team.id, users.salesAPAC.id)).status).toBe(403);
    });

    test('MM-71104-T11 sync removes non-qualifiers, auto-adds qualifiers and cascades to channels', async ({pw}) => {
        test.setTimeout(240_000);
        const {adminClient, adminUser, team, users} = await setupFixture(pw);

        const newEU = await createFixtureUser(adminClient, 'neweu', 'Sales', 'EU');
        await waitForAttributeViewToInclude(adminClient, orRule(), [newEU.id]);

        const channel = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(users.engAPAC.id, channel.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        await switchTeamRulesMode(page);
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');
        await rulesPanel.getByTestId('team-auto-add-members-checkbox').check();

        await page.getByTestId('saveSetting').click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.getByRole('button', {name: 'Apply'}).click();
        await expect.poll(() => getMembershipExpression(adminClient, team.id), {timeout: 15_000}).toBe(orRule());

        await triggerSyncJobAndPoll(adminClient, team.id);

        await expect
            .poll(
                async () => {
                    const ids = await getTeamMemberIds(adminClient, team.id);
                    return {
                        engUS: ids.includes(users.engUS.id),
                        salesEU: ids.includes(users.salesEU.id),
                        newEU: ids.includes(newEU.id),
                        engAPAC: ids.includes(users.engAPAC.id),
                        salesAPAC: ids.includes(users.salesAPAC.id),
                    };
                },
                {timeout: 60_000},
            )
            .toEqual({engUS: true, salesEU: true, newEU: true, engAPAC: false, salesAPAC: false});

        await expect
            .poll(() => verifyUserInChannel(adminClient, users.engAPAC.id, channel.id), {timeout: 60_000})
            .toBe(false);
    });

    test('MM-71104-T12 an Advanced rule is ANDed with a linked parent policy', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team, users} = await setupFixture(pw, {members: []});

        // Custom rule first: the helper hard-codes empty imports, and assigning the
        // parent afterwards keeps the existing rule.
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);
        const parentName = `Eng Parent ${pw.random.id()}`;
        const parent = await createTeamMembershipParentPolicy(adminClient, parentName, engineeringRule());
        createdPolicyIds.push(parent.id);
        await assignTeamsToPolicy(adminClient, parent.id, [team.id]);

        const setup: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(setup.policy.imports).toContain(parent.id);
        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());

        const base = adminClient.getBaseRoute();
        const token = adminClient.getToken();
        expect((await addTeamMemberRaw(token, base, team.id, users.engUS.id)).status).toBe(201);
        expect((await addTeamMemberRaw(token, base, team.id, users.engAPAC.id)).status).toBe(403);
        expect((await addTeamMemberRaw(token, base, team.id, users.salesEU.id)).status).toBe(403);

        const {page} = await pw.testBrowser.login(adminUser);
        await openTeamRules(page, team);
        const parentRow = page
            .locator('#team_access_control_with_policy')
            .locator('.policy-name')
            .filter({hasText: parentName});
        await expect(parentRow).toBeVisible({timeout: 15_000});

        // Saves re-emit the rule from its AST, dropping redundant parentheses; only
        // grouping that precedence needs round-trips verbatim.
        const editedRule = `(${orRule()}) && ${engineeringRule()}`;
        await typeTeamRulesCel(page, editedRule);
        await waitForTeamRulesValidation(page, 'validated');
        await page.getByTestId('saveSetting').click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.getByRole('button', {name: 'Apply'}).click();

        await expect.poll(() => getMembershipExpression(adminClient, team.id), {timeout: 15_000}).toBe(editedRule);

        // A successful save returns to the teams list; reopen to check the link survived.
        await openTeamConfig(page, team.display_name);
        await expect(parentRow).toBeVisible({timeout: 15_000});
        const saved: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(saved.policy.imports).toContain(parent.id);
    });

    test('MM-71104-T13 an Advanced rule on a public team stays advisory', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, team, users} = await setupFixture(pw, {members: [], publicTeam: true});
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const base = adminClient.getBaseRoute();
        const token = adminClient.getToken();
        expect((await addTeamMemberRaw(token, base, team.id, users.salesAPAC.id)).status).toBe(201);

        await adminClient.addToTeam(team.id, users.engAPAC.id);
        await triggerSyncJobAndPoll(adminClient, team.id);

        expect(await getTeamMemberIds(adminClient, team.id)).toContain(users.engAPAC.id);
    });

    test('MM-71104-T14a clearing the Advanced rule with no parent drops enforcement', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);
        await expect(rulesPanel.locator('.monaco-editor')).toBeVisible({timeout: 15_000});

        await clearMonaco(page);
        await page.getByTestId('saveSetting').click();
        await expect(page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'})).toHaveCount(0);

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {timeout: 15_000})
            .toBe(false);
    });

    test('MM-71104-T14b clearing the Advanced rule with a parent keeps only the parent', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);
        const parentName = `Eng Parent ${pw.random.id()}`;
        const parent = await createTeamMembershipParentPolicy(adminClient, parentName, engineeringRule());
        createdPolicyIds.push(parent.id);
        await assignTeamsToPolicy(adminClient, parent.id, [team.id]);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);
        await expect(rulesPanel.locator('.monaco-editor')).toBeVisible({timeout: 15_000});

        await clearMonaco(page);
        await page.getByTestId('saveSetting').click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.getByRole('button', {name: 'Apply'}).click();

        await expect
            .poll(async () => (await getMembershipExpression(adminClient, team.id)) ?? '', {timeout: 15_000})
            .toBe('');
        const saved: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(saved.policy.imports).toContain(parent.id);
    });

    test.describe('gating', () => {
        test.describe.configure({mode: 'serial'});

        test.afterAll(async () => {
            const {adminClient} = await getAdminClient({skipLog: true});
            await enableTeamMembershipPolicies(adminClient).catch(() => {});
        });

        test('MM-71104-T15a the rules section is hidden while the team toggle is off', async ({pw}) => {
            test.setTimeout(180_000);
            const {adminUser, team} = await setupFixture(pw);

            const {page} = await pw.testBrowser.login(adminUser);
            await openTeamRules(page, team);

            await setToggle(page, false);
            await expect(page.locator('#team_level_access_rules')).toHaveCount(0);
        });

        test('MM-71104-T15b the ABAC section is hidden when attribute-based access control is off', async ({pw}) => {
            test.setTimeout(180_000);
            const {adminClient, adminUser, team} = await setupFixture(pw);
            await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: false}} as any);

            const {page} = await pw.testBrowser.login(adminUser);
            await openTeamConfig(page, team.display_name);

            await expect(page.locator('[data-testid="policy-enforce-toggle-button"]')).toHaveCount(0);
            await expect(page.locator('#team_level_access_rules')).toHaveCount(0);
        });
    });

    test('MM-71104-T16 the Team Admin settings modal has no Advanced mode', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, team} = await setupFixture(pw);

        // Before the policy: joining a governed private team would be gated.
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.container.getByTestId('team_membership-tab-button').click();
        await expect(teamSettings.container.locator('.TeamMembershipTab')).toBeVisible({timeout: 10_000});

        await expect(page.getByTestId('team-rules-editor-mode-toggle')).toHaveCount(0);
        await expect(page.locator('.monaco-editor')).toHaveCount(0);

        // Read-only, not an empty table a team admin could save over.
        const locked = teamSettings.container.getByTestId('team-membership-locked-rules');
        await expect(locked).toBeVisible();
        await expect(locked.getByRole('status')).toContainText('can only be edited in the System Console');
        await expect(locked).toContainText(orRule());
        await expect(teamSettings.container.getByTestId('table-editor')).toHaveCount(0);
        await expect(teamSettings.container.locator('#autoAddMembersCheckbox')).toBeDisabled();

        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());
    });

    test('MM-71104-T17 discarding Advanced edits leaves the saved rule', async ({pw}) => {
        test.setTimeout(180_000);
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);
        await expect(rulesPanel.locator('.monaco-editor')).toBeVisible({timeout: 15_000});

        await typeTeamRulesCel(page, simpleRule());

        await page.locator('#cancelButtonSettings').click();
        const discardModal = page.getByRole('dialog').filter({hasText: 'Discard Changes?'});
        await expect(discardModal).toBeVisible({timeout: 5000});
        await discardModal.getByRole('button', {name: 'Yes, Discard'}).click();

        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());

        const reopened = await openTeamRules(page, team);
        await expect(reopened.locator('.cel-editor')).toContainText(orRule(), {timeout: 15_000});
    });

    test('MM-71104-T18 the toggle and Advanced editor are keyboard operable and accessible', async ({pw, axe}) => {
        test.setTimeout(180_000);
        const {adminUser, team} = await setupFixture(pw);

        const {page} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(page, team);

        const toggle = page.getByTestId('team-rules-editor-mode-toggle');
        await expect(toggle).toBeEnabled({timeout: 60_000});
        await toggle.focus();
        await page.keyboard.press('Enter');

        await expect(rulesPanel.locator('.monaco-editor')).toBeVisible();
        await expect(toggle).toBeFocused();

        const status = rulesPanel.locator('.cel-editor__status-message');
        await expect(status).toHaveAttribute('role', 'status');
        await expect(status).toHaveAttribute('aria-live', 'polite');

        // The empty-state placeholder has a role-less aria-label, so scan with a rule in place.
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');

        // Upstream Monaco bug: the suggest widget's aria-activedescendant points at an
        // unrendered row, and the widget stays in the DOM once shown.
        const results = await axe
            .builder(page, {disableColorContrast: true})
            .include('#team_level_access_rules')
            .exclude('#team_level_access_rules .suggest-widget')
            .analyze();
        expect(results.violations).toHaveLength(0);
    });
});
