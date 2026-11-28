// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Advanced (CEL) mode for the Team-specific membership rules editor on the
 *            System Console per-team page: authoring, validation, save, enforcement and sync.
 * @reference MM-71104
 */

import type {UserProfile} from '@mattermost/types/users';

import {
    Api,
    waitForApi,
    openTeamSettings,
    expect,
    getAdminClient,
    getRandomId,
    hasCustomPermissionsSchemesLicense,
    ignoreMissing,
    Msg,
    newTestPassword,
    test,
    testIdSelector,
    verifyUserInChannel,
} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    createPrivateChannel,
    createTeamAdmin,
    createTeamMembershipPolicy,
    getTeamAccessControlPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {createUserAttributeField, testAccessRule} from '../support';
import {getStoredPolicyRuleExpressions, setFieldAsSharedOnly} from '../masking/masking_db_setup';
import {createMaskingTextField, deleteCPAField, enableMaskingFlag} from '../masking/masking_helpers';

import {
    addTeamAttributeRule,
    clearMonaco,
    createFixtureUser,
    expectServerRejection,
    getMembershipExpression,
    getTeamMemberIds,
    openTeamRules,
    setupAdvancedTeamFixture,
    type FixtureLabel,
    type MemberLabel,
} from './team_advanced_rules_helpers';
import {
    addTeamMemberRaw,
    assignTeamsToPolicy,
    cleanUpCreated,
    createTeamMembershipParentPolicy,
    enableTeamMembershipPolicies,
    findPolicyRow,
    openTeamConfig,
    setToggle,
    switchTeamRulesToAdvanced,
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

// Valid CEL that /cel/check accepts, but membership sync can't turn into SQL.
const ternaryRule = () => `user.attributes.${LOC} == "US" ? true : false`;

const ADVANCED_RULE_ERROR_ID = 'app.pap.save_policy.advanced_rule_requires_system_admin';
const UNSUPPORTED_FUNCTION_ERROR_ID = 'app.pap.save_policy.membership_rule_unsupported_function';
const NOT_SQLIZABLE_MESSAGE = 'membership sync cannot evaluate';

// Team rosters only ever draw on the first four.

const FIXTURE_ATTRIBUTES: Record<FixtureLabel, {dept: string; loc: string}> = {
    engUS: {dept: 'Engineering', loc: 'US'},
    engAPAC: {dept: 'Engineering', loc: 'APAC'},
    salesEU: {dept: 'Sales', loc: 'EU'},
    salesAPAC: {dept: 'Sales', loc: 'APAC'},
    newEU: {dept: 'Sales', loc: 'EU'},
    salesUS: {dept: 'Sales', loc: 'US'},
    sysAPAC: {dept: 'Engineering', loc: 'APAC'},
    teamAdminSalesUS: {dept: 'Sales', loc: 'US'},
};

test.describe('ABAC - Team Advanced membership rules', {tag: ['@abac', '@team_membership']}, () => {
    const fieldIds: string[] = [];
    const createdPolicyIds: string[] = [];
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];
    const fixtureUserIds: string[] = [];
    let users = {} as Record<FixtureLabel, UserProfile>;

    // Users and attributes are shared: the attribute view refreshes only every 30s, so
    // waiting for it once here instead of per test is most of this file's runtime.
    test.beforeAll(async () => {
        test.setTimeout(120_000);
        const {adminClient} = await getAdminClient({skipLog: true});
        const license = await adminClient.getClientLicenseOld();
        test.skip(license.IsLicensed === 'false', 'Skipping test - server not licensed');

        await enableTeamMembershipPolicies(adminClient);
        for (const name of [DEPT, LOC]) {
            const field = await createUserAttributeField(adminClient, name);
            fieldIds.push(field.id);
        }

        users = {} as Record<FixtureLabel, UserProfile>;
        for (const [label, attrs] of Object.entries(FIXTURE_ATTRIBUTES) as Array<
            [FixtureLabel, {dept: string; loc: string}]
        >) {
            users[label] = await createFixtureUser(adminClient, label, attrs.dept, attrs.loc, DEPT, LOC);
            fixtureUserIds.push(users[label].id);
        }
        await adminClient.updateUserRoles(users.sysAPAC.id, 'system_user system_admin');

        await waitForAttributeViewToInclude(adminClient, orRule(), [
            users.engUS.id,
            users.salesEU.id,
            users.newEU.id,
            users.salesUS.id,
            users.teamAdminSalesUS.id,
        ]);
        await waitForAttributeViewToInclude(adminClient, `user.attributes.${LOC} == "APAC"`, [
            users.engAPAC.id,
            users.salesAPAC.id,
            users.sysAPAC.id,
        ]);
        await waitForAttributeViewToInclude(adminClient, engineeringRule(), [
            users.engUS.id,
            users.engAPAC.id,
            users.sysAPAC.id,
        ]);
        await waitForAttributeViewToInclude(adminClient, simpleRule(), [
            users.salesEU.id,
            users.salesAPAC.id,
            users.newEU.id,
            users.salesUS.id,
            users.teamAdminSalesUS.id,
        ]);
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        await cleanUpCreated(adminClient, {userIds: fixtureUserIds.splice(0)});
        for (const id of fieldIds.splice(0)) {
            await ignoreMissing(() =>
                (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/custom_profile_attributes/fields/${id}`, {
                    method: 'DELETE',
                }),
            );
        }
    });

    test.afterEach(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        const teamIds = createdTeamIds.splice(0);

        // Team child policies are keyed by the team id.
        await cleanUpCreated(adminClient, {
            policyIds: [...teamIds, ...createdPolicyIds.splice(0)],
            teamIds,
            userIds: createdUserIds.splice(0),
        });
    });

    // Each test gets its own team; the users come from beforeAll.
    async function setupFixture(pw: PlaywrightExtended, options: {members?: MemberLabel[]; publicTeam?: boolean} = {}) {
        return setupAdvancedTeamFixture(pw, users, createdTeamIds, options);
    }

    test('MM-71104-T1 toggle defaults to Simple and carries the rule across modes', async ({pw}) => {
        const {adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);

        await addTeamAttributeRule(app, 'Engineering', DEPT);

        const toggle = app.admin.team.accessRules.switchModeButton;
        await expect(toggle).toHaveText('Switch to Advanced Mode');

        await switchTeamRulesToAdvanced(page);
        await expect(rulesPanel.rules.input).toBeVisible();
        await expect(rulesPanel.rules.input).toContainText(`user.attributes.${DEPT} == "Engineering"`);

        await expect(toggle).toHaveText('Switch to Simple Mode');
        await expect(toggle).toBeEnabled();
        await toggle.click();

        await expect(rulesPanel.rules.row(0).valueInputTextbox).toHaveValue('Engineering');
    });

    test('MM-71104-T2 saves a valid Advanced OR rule on a private team', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');

        const jobResponse = waitForApi(page, Api.CreateJob, {timeout: 30_000});
        await app.admin.team.savePanel.saveButton.click();

        const confirmModal = app.admin.team.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await expect(confirmModal).toContainMessage(Msg.admin.team_settings.team_detail.save_confirm.body, {count: 1});
        await confirmModal.confirmButton.click();
        await expect(confirmModal).not.toBeVisible();

        const job = await jobResponse;
        expect(job.type).toBe('access_control_team_sync');
        expect(job.data?.policy_id).toBe(team.id);

        await expect.poll(() => getMembershipExpression(adminClient, team.id), {timeout: 15_000}).toBe(orRule());
    });

    test('MM-71104-T3 a saved complex rule opens in Advanced with Simple locked', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);

        await expect(rulesPanel.rules.input).toBeVisible({timeout: 15_000});
        const toggle = app.admin.team.accessRules.switchModeButton;
        await expect(toggle).toHaveText('Switch to Simple Mode');
        await expect(toggle).toBeDisabled();
    });

    test('MM-71104-T4 a simple rule typed in Advanced can go back to Simple', async ({pw}) => {
        const {adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, simpleRule());
        await waitForTeamRulesValidation(page, 'validated');

        const toggle = app.admin.team.accessRules.switchModeButton;
        await expect(toggle).toBeEnabled();
        await toggle.click();

        await expect(rulesPanel.rules.row(0).valueInputTextbox).toHaveValue('Sales');
    });

    test('MM-71104-T5 invalid CEL blocks Save and nothing is persisted, including a parent link', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const parentName = `Eng Parent ${pw.random.id()}`;
        const parent = await createTeamMembershipParentPolicy(adminClient, parentName, engineeringRule());
        createdPolicyIds.push(parent.id);

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);

        await app.admin.team.accessPolicy.linkButton.click();
        const modal = app.policySelectionModal;
        await expect(modal).toBeVisible({timeout: 5000});
        const policyRow = await findPolicyRow(app, parentName);
        await policyRow.container.click();
        await expect(app.admin.team.accessPolicy.policy(parent).nameText).toBeVisible({timeout: 5000});

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, invalidRule());
        await waitForTeamRulesValidation(page, 'error');

        await app.admin.team.savePanel.saveButton.click();

        await expect(app.admin.team.savePanel.errorText).toContainText('Fix the errors');
        await expect(app.admin.team.saveConfirmModal).toHaveCount(0);

        expect((await adminClient.getTeam(team.id)).policy_enforced).toBeFalsy();
        const response: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(response?.policy?.imports ?? []).not.toContain(parent.id);
    });

    test('MM-71104-T6 Save during the validation delay is still blocked', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, invalidRule());
        await app.admin.team.savePanel.saveButton.click();

        await expect(app.admin.team.savePanel.errorText).toContainText('Fix the errors', {
            timeout: 10_000,
        });
        await expect(app.admin.team.saveConfirmModal).toHaveCount(0);
        expect((await adminClient.getTeam(team.id)).policy_enforced).toBeFalsy();
        expect(await getMembershipExpression(adminClient, team.id)).toBeUndefined();
    });

    test('MM-71104-T7 resource attribute references are rejected', async ({pw}) => {
        const {adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, 'resource.attributes.Program == "x"');

        await expect(rulesPanel.container).toContainMessage(
            Msg.admin.team_settings.team_detail.rules.error.resource_attributes,
        );

        await app.admin.team.savePanel.saveButton.click();
        await expect(app.admin.team.savePanel.errorText).toContainText('Fix the errors');
        await expect(app.admin.team.saveConfirmModal).toHaveCount(0);
    });

    test('MM-71104-T8 session attribute references are rejected', async ({pw}) => {
        const {adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);
        const status = rulesPanel.rules.statusText;

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, 'user.session.ip == "1.2.3.4"');

        // * The server's membership check rejects it as it is typed
        await waitForTeamRulesValidation(page, 'error');
        await expect(status).toContainText('session attributes');

        // CEL allows whitespace around the member dot, so this is the same reference.
        await typeTeamRulesCel(page, 'user . session.ip == "1.2.3.4"');
        await waitForTeamRulesValidation(page, 'error');
        await expect(status).toContainText('session attributes');

        await app.admin.team.savePanel.saveButton.click();
        await expect(app.admin.team.savePanel.errorText).toContainText('Fix the errors');
        await expect(app.admin.team.saveConfirmModal).toHaveCount(0);
    });

    test('MM-71104-T9 Test access rule in Advanced previews workspace-wide matches', async ({pw}) => {
        const {adminUser, team, users} = await setupFixture(pw, {members: ['engUS', 'engAPAC']});

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);

        await switchTeamRulesToAdvanced(page);
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
        const adminDenied = await addTeamMemberRaw(token, base, team.id, users.sysAPAC.id);
        expect(adminDenied.status).toBe(403);

        const memberIds = await getTeamMemberIds(adminClient, team.id);
        expect(memberIds).not.toContain(users.salesAPAC.id);
        expect(memberIds).not.toContain(users.sysAPAC.id);
    });

    test('MM-71104-T10b a grouped rule is enforced as written by both the join gate and sync', async ({pw}) => {
        test.setTimeout(120_000);
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
        const base = adminClient.getBaseRoute();
        const token = adminClient.getToken();
        expect((await addTeamMemberRaw(token, base, team.id, users.salesUS.id)).status).toBe(201);
        expect((await addTeamMemberRaw(token, base, team.id, users.engUS.id)).status).toBe(403);
        expect((await addTeamMemberRaw(token, base, team.id, users.salesAPAC.id)).status).toBe(403);
    });

    test('MM-71104-T11 sync removes non-qualifiers, auto-adds qualifiers and cascades to channels', async ({pw}) => {
        test.setTimeout(120_000);
        const {adminClient, adminUser, team, users} = await setupFixture(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(users.engAPAC.id, channel.id);

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');
        await app.admin.team.autoAddMembersCheckbox.check();
        await expect(app.admin.team.autoAddMembersCheckbox).toBeChecked();

        await app.admin.team.savePanel.saveButton.click();
        const confirmModal = app.admin.team.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.confirmButton.click();
        await expect.poll(() => getMembershipExpression(adminClient, team.id), {timeout: 15_000}).toBe(orRule());

        await triggerSyncJobAndPoll(adminClient, team.id);

        await expect
            .poll(
                async () => {
                    const ids = await getTeamMemberIds(adminClient, team.id);
                    return {
                        engUS: ids.includes(users.engUS.id),
                        salesEU: ids.includes(users.salesEU.id),
                        newEU: ids.includes(users.newEU.id),
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

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);
        const parentRow = app.admin.team.accessPolicy.policy(parent).nameText;
        await expect(parentRow).toBeVisible({timeout: 15_000});

        // Saves re-emit the rule from its AST, dropping redundant parentheses; only
        // grouping that precedence needs round-trips verbatim.
        const editedRule = `(${orRule()}) && ${engineeringRule()}`;
        await typeTeamRulesCel(page, editedRule);
        await waitForTeamRulesValidation(page, 'validated');
        await app.admin.team.savePanel.saveButton.click();
        const confirmModal = app.admin.team.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.confirmButton.click();

        await expect.poll(() => getMembershipExpression(adminClient, team.id), {timeout: 15_000}).toBe(editedRule);

        // A successful save returns to the teams list; reopen to check the link survived.
        await openTeamConfig(app, team.display_name);
        await expect(parentRow).toBeVisible({timeout: 15_000});
        const saved: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(saved.policy.imports).toContain(parent.id);
    });

    test('MM-71104-T13 an Advanced rule on a public team stays advisory', async ({pw}) => {
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
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);
        await expect(rulesPanel.rules.input).toBeVisible({timeout: 15_000});

        await clearMonaco(app);
        await app.admin.team.savePanel.saveButton.click();
        await expect(app.admin.team.saveConfirmModal).toHaveCount(0);

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {timeout: 15_000})
            .toBe(false);
    });

    test('MM-71104-T14b clearing the Advanced rule with a parent keeps only the parent', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);
        const parentName = `Eng Parent ${pw.random.id()}`;
        const parent = await createTeamMembershipParentPolicy(adminClient, parentName, engineeringRule());
        createdPolicyIds.push(parent.id);
        await assignTeamsToPolicy(adminClient, parent.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);
        await expect(rulesPanel.rules.input).toBeVisible({timeout: 15_000});

        await clearMonaco(app);
        await app.admin.team.savePanel.saveButton.click();
        const confirmModal = app.admin.team.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.confirmButton.click();

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
            await enableTeamMembershipPolicies(adminClient);
        });

        test('MM-71104-T15a the rules section is hidden while the team toggle is off', async ({pw}) => {
            const {adminUser, team} = await setupFixture(pw);

            const {app} = await pw.testBrowser.login(adminUser);
            await openTeamRules(app, team);

            await setToggle(app, false);
            await expect(app.admin.team.accessRules.container).toHaveCount(0);
        });

        test('MM-71104-T15b the ABAC section is hidden when attribute-based access control is off', async ({pw}) => {
            const {adminClient, adminUser, team} = await setupFixture(pw);
            await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: false}} as any);

            const {app} = await pw.testBrowser.login(adminUser);
            await openTeamConfig(app, team.display_name);

            await expect(app.admin.team.policyEnforce.container).toHaveCount(0);
            await expect(app.admin.team.accessRules.container).toHaveCount(0);
        });
    });

    test('MM-71104-T16 the Team Admin settings modal has no Advanced mode', async ({pw}) => {
        const {adminClient, team} = await setupFixture(pw);

        // Before the policy: joining a governed private team would be gated.
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: {name: 'town-square'}});
        await expect(app.center.postCreate.message.container).toBeVisible();

        const teamSettings = await openTeamSettings(app);
        await teamSettings.tabs.tab('team_membership').select();
        await expect(teamSettings.membership.container).toBeVisible({timeout: 10_000});

        await expect(app.admin.team.accessRules.switchModeButton).toHaveCount(0);
        // The team-admin form has no CEL input part; prove the native Monaco subtree is absent within its generated scope.
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the absence of the Monaco editor is the thing under test, and Monaco's root cannot take a test id
        await expect(teamSettings.membership.container.locator.locator('.monaco-editor')).toHaveCount(0);

        // Read-only, not an empty table a team admin could save over.
        const locked = teamSettings.membership.lockedRules;
        await expect(locked).toBeVisible();
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the locked notice's status role is the thing under test
        await expect(locked.locator.getByRole('status')).toContainMessage(
            Msg.team_settings.membership_tab.advanced_rules_locked,
        );
        await expect(locked).toContainText(orRule());
        await expect(teamSettings.membership.rules.container).toHaveCount(0);
        await expect(teamSettings.membership.autoAddCheckbox).toBeDisabled();

        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());
    });

    test('MM-71104-T16b the Team Admin settings modal keeps the table for a rule the parser accepts', async ({pw}) => {
        const {adminClient, team} = await setupFixture(pw);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // A plain table rule whose value happens to contain "&&"
        const rule = `user.attributes.${DEPT} == "R&&D"`;
        await createTeamMembershipPolicy(adminClient, team.id, rule, false);

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: {name: 'town-square'}});
        await expect(app.center.postCreate.message.container).toBeVisible();

        const teamSettings = await openTeamSettings(app);
        await teamSettings.tabs.tab('team_membership').select();
        await expect(teamSettings.membership.container).toBeVisible({timeout: 10_000});

        // * The rule is editable in the table, not locked
        await expect(teamSettings.membership.rules.container).toBeVisible({timeout: 15_000});
        await expect(teamSettings.membership.lockedRules).toHaveCount(0);
        await expect(teamSettings.membership.autoAddCheckbox).toBeEnabled();
    });

    test('MM-71104-T16c the Team Admin settings modal keeps a masked rule editable and saves without losing hidden values', async ({
        pw,
    }) => {
        const {adminClient, team} = await setupFixture(pw);
        await enableMaskingFlag(adminClient);

        // # The team admin holds Alpha but not Bravo, so Bravo is masked for them
        const fieldName = `Prog${getRandomId()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        try {
            const teamAdmin = await createTeamAdmin(adminClient, team.id);
            createdUserIds.push(teamAdmin.id);
            await setUserAttribute(adminClient, teamAdmin.id, fieldName, 'Alpha');

            const rule = `user.attributes.${fieldName} in ["Alpha", "Bravo"]`;
            await createTeamMembershipPolicy(adminClient, team.id, rule, false);

            // Masking only hides values of fields whose values are shared only with holders.
            await setFieldAsSharedOnly(fieldId);

            const {app} = await pw.testBrowser.login(teamAdmin);
            await app.channelsPage.goto({team, channel: {name: 'town-square'}});
            await expect(app.center.postCreate.message.container).toBeVisible();

            const teamSettings = await openTeamSettings(app);
            await teamSettings.tabs.tab('team_membership').select();
            const tab = teamSettings.membership.container;
            await expect(tab).toBeVisible({timeout: 10_000});

            // * The masked rule is shown in the table, not locked
            await expect(teamSettings.membership.rules.container).toBeVisible({timeout: 15_000});
            await expect(teamSettings.membership.rules.row(0).maskedImg).toBeVisible({timeout: 10_000});
            await expect(teamSettings.membership.lockedRules).toHaveCount(0);

            // # Turn on auto-add and save
            const autoAdd = teamSettings.membership.autoAddCheckbox;
            await expect(autoAdd).toBeEnabled();
            await autoAdd.check();
            await expect(autoAdd).toBeChecked();

            await teamSettings.savePanel.saveButton.click();
            const confirmModal = teamSettings.membership.rulesChangeModal;
            await expect(confirmModal).toBeVisible({timeout: 15_000});
            await confirmModal.confirmButton.click();
            await expect(confirmModal).not.toBeVisible({timeout: 10_000});
            await expect(teamSettings.savePanel.saveButton).not.toBeVisible({timeout: 10_000});

            // * The hidden value survived the save. Read the DB: the API masks for every
            //   admin, and the sysadmin holds neither value.
            //   Storage references the field by id, not by name.
            const stored = await getStoredPolicyRuleExpressions(team.id);
            expect(stored).toHaveLength(1);
            expect(stored[0]).toContain(`id_${fieldId}`);
            expect(stored[0]).toContain('in ["Alpha", "Bravo"]');

            // * Auto-add is on
            const response: any = await getTeamAccessControlPolicy(adminClient, team.id);
            const membershipRule = response?.policy?.rules?.find((r: any) => r.actions?.includes('membership'));
            expect(membershipRule?.metadata?.auto_add).toBe('always');
        } finally {
            // A shared_only field can't be deleted through the API; this falls back to the DB.
            await deleteCPAField(adminClient, fieldId);
        }
    });

    test('MM-71104-T17 discarding Advanced edits leaves the saved rule', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);
        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);
        await expect(rulesPanel.rules.input).toBeVisible({timeout: 15_000});

        await typeTeamRulesCel(page, simpleRule());

        await app.admin.team.savePanel.cancelLink.click();
        const discardModal = app.discardChangesModal;
        await expect(discardModal).toBeVisible({timeout: 5000});
        await discardModal.confirmButton.click();
        await expect(discardModal).not.toBeVisible();

        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());

        const reopened = await openTeamRules(app, team);
        await expect(reopened.rules.input).toContainText(orRule(), {timeout: 15_000});
    });

    test('MM-71104-T18 the toggle and Advanced editor are keyboard operable and accessible', async ({pw, axe}) => {
        const {adminUser, team} = await setupFixture(pw);

        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);

        const toggle = app.admin.team.accessRules.switchModeButton;
        await expect(toggle).toBeEnabled({timeout: 60_000});
        await toggle.focus();
        await expect(toggle).toBeFocused();
        await toggle.press('Enter');

        await expect(rulesPanel.rules.input).toBeVisible();
        await expect(toggle).toBeFocused();

        const status = rulesPanel.rules.statusText;
        await expect(status).toHaveAttribute('role', 'status');
        await expect(status).toHaveAttribute('aria-live', 'polite');

        // The empty-state placeholder has a role-less aria-label, so scan with a rule in place.
        await typeTeamRulesCel(page, orRule());
        await waitForTeamRulesValidation(page, 'validated');

        // Upstream Monaco bug: the suggest widget's aria-activedescendant points at an
        // unrendered row, and the widget stays in the DOM once shown.
        const results = await axe
            .builder(page, {disableColorContrast: true, within: rulesPanel})
            .exclude(`${testIdSelector(rulesPanel)} .suggest-widget`)
            .analyze();
        expect(results.violations).toHaveLength(0);
    });

    /**
     * @objective The server, not just the UI, keeps Advanced team rules System Admin only.
     */
    test('MM-71104-T19 team admin API writes and deletes of an Advanced rule are refused', async ({pw}) => {
        const {adminClient, team, users} = await setupFixture(pw);

        // # A team admin who satisfies both rules, so self-inclusion never decides the outcome
        const teamAdmin = users.teamAdminSalesUS;
        await adminClient.addToTeam(team.id, teamAdmin.id);
        await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/teams/${team.id}/members/${teamAdmin.id}/roles`,
            {
                method: 'put',
                body: JSON.stringify({roles: 'team_user team_admin'}),
            },
        );
        const {client: teamAdminClient} = await pw.makeClient({
            username: teamAdmin.username,
            password: teamAdmin.password,
        });

        // * Writing a new Advanced rule is refused
        await expectServerRejection(
            () => createTeamMembershipPolicy(teamAdminClient, team.id, orRule()),
            403,
            ADVANCED_RULE_ERROR_ID,
            'team admin wrote an Advanced rule',
        );
        expect(await getMembershipExpression(adminClient, team.id)).toBeUndefined();

        // * A simple rule is still theirs to write
        await createTeamMembershipPolicy(teamAdminClient, team.id, simpleRule());
        expect(await getMembershipExpression(adminClient, team.id)).toBe(simpleRule());

        // # A System Admin replaces it with an Advanced rule
        await createTeamMembershipPolicy(adminClient, team.id, orRule());

        // * Replacing it with a simple rule is refused
        await expectServerRejection(
            () => createTeamMembershipPolicy(teamAdminClient, team.id, simpleRule()),
            403,
            ADVANCED_RULE_ERROR_ID,
            'team admin replaced an Advanced rule',
        );

        // * Deleting the policy is refused
        await expectServerRejection(
            () => teamAdminClient.deleteAccessControlPolicy(team.id, team.id),
            403,
            ADVANCED_RULE_ERROR_ID,
            'team admin deleted an Advanced rule',
        );

        // * Resubmitting it unchanged is allowed, so unrelated saves aren't blocked
        await createTeamMembershipPolicy(teamAdminClient, team.id, orRule());

        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());
    });

    /**
     * @objective A membership rule that sync can't run as SQL is rejected while it is typed and
     *            on save, instead of being stored and silently never enforced.
     */
    test('MM-71104-T20 a rule membership sync cannot evaluate is rejected', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);

        // * The API refuses it even for a System Admin
        await expectServerRejection(
            () => createTeamMembershipPolicy(adminClient, team.id, ternaryRule()),
            400,
            UNSUPPORTED_FUNCTION_ERROR_ID,
            'system admin saved a ternary membership rule',
        );

        // # Type the same rule in the Advanced editor
        const {page, app} = await pw.testBrowser.login(adminUser);
        const rulesPanel = await openTeamRules(app, team);
        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, ternaryRule());

        // * The editor's membership check flags it before save
        await waitForTeamRulesValidation(page, 'error');
        await expect(rulesPanel.rules.statusText).toContainText(NOT_SQLIZABLE_MESSAGE);
        await expect(rulesPanel.rules.statusText).toContainText('the conditional operator (?:)');

        // * Save is blocked before anything is written
        await app.admin.team.savePanel.saveButton.click();
        await expect(app.admin.team.savePanel.errorText).toContainText('Fix the errors');
        await expect(app.admin.team.saveConfirmModal).toHaveCount(0);

        // * Nothing was persisted
        expect(await getMembershipExpression(adminClient, team.id)).toBeUndefined();
        expect((await adminClient.getTeam(team.id)).policy_enforced).toBeFalsy();
    });

    // Parent links are written before the team policy, and nothing rolls them back when the
    // policy save fails. Enable once the save order or a rollback is fixed. The editor now
    // catches a ternary before save, so this needs a rule only the save rejects, such as
    // one that excludes the admin.
    test.fixme('MM-71104-T20b a rejected save does not leave a parent link behind', async ({pw}) => {
        const {adminClient, adminUser, team} = await setupFixture(pw);

        const parentName = `Eng Parent ${pw.random.id()}`;
        const parent = await createTeamMembershipParentPolicy(adminClient, parentName, engineeringRule());
        createdPolicyIds.push(parent.id);

        const {page, app} = await pw.testBrowser.login(adminUser);
        await openTeamRules(app, team);

        await app.admin.team.accessPolicy.linkButton.click();
        const modal = app.policySelectionModal;
        await expect(modal).toBeVisible({timeout: 5000});
        await (await findPolicyRow(app, parentName)).container.click();
        await expect(app.admin.team.accessPolicy.policy(parent).nameText).toBeVisible();

        await switchTeamRulesToAdvanced(page);
        await typeTeamRulesCel(page, ternaryRule());
        await waitForTeamRulesValidation(page, 'validated');
        await app.admin.team.savePanel.saveButton.click();

        const confirmModal = app.admin.team.saveConfirmModal;
        await expect(confirmModal).toBeVisible({timeout: 15_000});
        await confirmModal.confirmButton.click();
        await expect(app.admin.team.savePanel.errorText).toContainText(NOT_SQLIZABLE_MESSAGE, {timeout: 15_000});

        const response: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(response?.policy?.imports ?? []).not.toContain(parent.id);
    });

    /**
     * @objective The System Console team membership rules section is System Admin only;
     *            a System Manager sees neither the rule nor the Advanced toggle.
     */
    test('MM-71104-T21 a System Manager does not see the team membership rules section', async ({pw}) => {
        const {adminClient, team} = await setupFixture(pw);

        // Assigning system_manager needs the Custom Permission Schemes license feature.
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasCustomPermissionsSchemesLicense(license),
            'Skipping test - server does not have Custom Permission Schemes',
        );

        await createTeamMembershipPolicy(adminClient, team.id, orRule(), false);

        // # A System Manager: console access to teams, but not manage_system
        const username = `sysmanager${getRandomId()}`;
        const password = newTestPassword();
        const systemManager = await adminClient.createUser(
            {email: `${username}@sample.mattermost.com`, username, password} as any,
            '',
            '',
        );
        createdUserIds.push(systemManager.id);
        systemManager.password = password;
        await adminClient.updateUserRoles(systemManager.id, 'system_user system_manager');
        await adminClient.savePreferences(systemManager.id, [
            {user_id: systemManager.id, category: 'tutorial_step', name: systemManager.id, value: '999'},
            {user_id: systemManager.id, category: 'onboarding', name: 'complete', value: 'true'},
            {
                user_id: systemManager.id,
                category: 'onboarding_task_list',
                name: 'onboarding_task_list_show',
                value: 'false',
            },
        ]);

        const {page, app} = await pw.testBrowser.login(systemManager);

        // The Teams list hides governed private teams from non-system admins who don't
        // qualify for them, so open the team page by URL.
        await page.goto(`/admin_console/user_management/teams/${team.id}`);
        // The page has loaded once the team's own Team Management panel shows (the email-domain switch is always there).
        await expect(app.admin.team.allowAll.container).toBeVisible({timeout: 15_000});

        // * The access control settings are stripped from a System Manager's config, so the
        //   whole ABAC section stays hidden: no enforce toggle, no rules, no Advanced toggle
        await expect(app.admin.team.policyEnforce.container).toHaveCount(0);
        await expect(app.admin.team.accessRules.container).toHaveCount(0);
        await expect(app.admin.team.accessRules.switchModeButton).toHaveCount(0);

        expect(await getMembershipExpression(adminClient, team.id)).toBe(orRule());
    });
});
