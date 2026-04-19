// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {
    expect,
    test,
    enableABAC,
    navigateToABACPage,
    runSyncJob,
    verifyUserInChannel,
    updateUserAttributes,
    createUserWithAttributes,
    getAdminClient,
    TestBrowser,
    getRandomId,
} from '@mattermost/playwright-lib';

import {
    ensureUserAttributes,
    createPrivateChannelForABAC,
    createBasicPolicy,
    createAdvancedPolicy,
    activatePolicy,
    waitForLatestSyncJob,
} from '../support';

/**
 * ABAC LDAP Integration - Sync
 *
 * Each of MM-T5797/98/99 originally ran two policy+sync cycles in one test
 * (steps 1 and 2 covering different operators / auto-add settings). Each
 * cycle spent 30-60s waiting for sync propagation, so the composite test
 * took 2½–3+ minutes — the main drivers of the shard-6 timeout.
 *
 * Refactor: each MM-T test is now a describe block with a shared beforeAll
 * (admin client + team + system-console session) and one test per step.
 * The expensive sync wait happens per-test, but tests within a file still
 * run serially in one worker so the logged-in console page is reused.
 */

// ─── MM-T5797: Auto-add TRUE ────────────────────────────────────────────────

test.describe('ABAC LDAP Integration - Sync - MM-T5797 auto-add true', () => {
    let sharedAdminClient: any;
    let sharedTeamId: string;
    let systemConsolePage: {page: Page};
    let sharedTestBrowser: TestBrowser | null = null;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(120000);

        const {adminClient, adminUser} = await getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        sharedAdminClient = adminClient;

        try {
            const lic = await adminClient.getClientLicenseOld();
            if (!lic || lic.IsLicensed !== 'true') {
                licensed = false;
                return;
            }
        } catch {
            licensed = false;
            return;
        }

        await ensureUserAttributes(adminClient, ['Department']);

        const suffix = getRandomId();
        const team = await adminClient.createTeam({
            name: `abac-ldap97-${suffix}`,
            display_name: `ABAC-LDAP97 ${suffix}`,
            type: 'O',
        } as any);
        sharedTeamId = team.id;

        sharedTestBrowser = new TestBrowser(browser);
        const loggedIn = await sharedTestBrowser.login(adminUser);
        systemConsolePage = loggedIn.systemConsolePage;
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);
    });

    test.afterAll(async () => {
        await sharedTestBrowser?.close().catch(() => {});
    });

    test('MM-T5797_a LDAP sync auto-adds user with = operator when attribute becomes qualifying', async () => {
        test.setTimeout(120000);
        test.skip(!licensed, 'No ABAC license');

        const user = await createUserWithAttributes(sharedAdminClient, {Department: 'Sales'});
        await sharedAdminClient.addToTeam(sharedTeamId, user.id);

        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `LDAP AutoAdd Single ${getRandomId()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true,
            channels: [channel.display_name],
        });

        await systemConsolePage.page.waitForTimeout(2000);

        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        await searchInput.fill(policyName.match(/([a-z0-9]+)$/i)?.[1] || policyName);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const initialCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(initialCheck).toBe(false);

        await updateUserAttributes(sharedAdminClient, user.id, {Department: 'Engineering'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const afterSync = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(afterSync).toBe(true);
    });

    test('MM-T5797_b LDAP sync auto-adds user with contains operator when attribute becomes qualifying', async () => {
        test.setTimeout(120000);
        test.skip(!licensed, 'No ABAC license');

        const user = await createUserWithAttributes(sharedAdminClient, {Department: 'Sales'});
        await sharedAdminClient.addToTeam(sharedTeamId, user.id);

        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `LDAP AutoAdd Contains ${getRandomId()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: 'user.attributes.Department.contains("Eng")',
            autoSync: true,
            channels: [channel.display_name],
        });

        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.fill(policyName.match(/([a-z0-9]+)$/i)?.[1] || policyName);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const initialCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(initialCheck).toBe(false);

        await updateUserAttributes(sharedAdminClient, user.id, {Department: 'Engineering'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const afterSync = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(afterSync).toBe(true);
    });
});

// ─── MM-T5798: Auto-add FALSE, admin adds after sync ────────────────────────

test.describe('ABAC LDAP Integration - Sync - MM-T5798 auto-add false, admin adds', () => {
    let sharedAdminClient: any;
    let sharedTeamId: string;
    let systemConsolePage: {page: Page};
    let sharedTestBrowser: TestBrowser | null = null;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(120000);

        const {adminClient, adminUser} = await getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        sharedAdminClient = adminClient;

        try {
            const lic = await adminClient.getClientLicenseOld();
            if (!lic || lic.IsLicensed !== 'true') {
                licensed = false;
                return;
            }
        } catch {
            licensed = false;
            return;
        }

        await ensureUserAttributes(adminClient);

        const suffix = getRandomId();
        const team = await adminClient.createTeam({
            name: `abac-ldap98-${suffix}`,
            display_name: `ABAC-LDAP98 ${suffix}`,
            type: 'O',
        } as any);
        sharedTeamId = team.id;

        sharedTestBrowser = new TestBrowser(browser);
        const loggedIn = await sharedTestBrowser.login(adminUser);
        systemConsolePage = loggedIn.systemConsolePage;
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);
    });

    test.afterAll(async () => {
        await sharedTestBrowser?.close().catch(() => {});
    });

    test('MM-T5798_a admin can add user with = operator after LDAP sync brings qualifying attribute', async () => {
        test.setTimeout(120000);
        test.skip(!licensed, 'No ABAC license');

        const user = await createUserWithAttributes(sharedAdminClient, {Department: 'Sales'});
        await sharedAdminClient.addToTeam(sharedTeamId, user.id);

        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `LDAP Sync Equals ${getRandomId()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
            channels: [channel.display_name],
        });

        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        await searchInput.fill(policyName.match(/([a-z0-9]+)$/i)?.[1] || policyName);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const initialCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(initialCheck).toBe(false);

        await updateUserAttributes(sharedAdminClient, user.id, {Department: 'Engineering'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const afterSync = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        if (!afterSync) {
            await sharedAdminClient.addToChannel(user.id, channel.id);
            const afterAdminAdd = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
            expect(afterAdminAdd).toBe(true);
        }

        const finalCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(finalCheck).toBe(true);
    });

    test('MM-T5798_b admin can add user with in operator after LDAP sync brings qualifying attribute', async () => {
        test.setTimeout(120000);
        test.skip(!licensed, 'No ABAC license');

        const user = await createUserWithAttributes(sharedAdminClient, {Department: 'Marketing'});
        await sharedAdminClient.addToTeam(sharedTeamId, user.id);

        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `LDAP Sync In ${getRandomId()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: 'user.attributes.Department in ["Engineering", "Product"]',
            autoSync: false,
            channels: [channel.display_name],
        });

        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.fill(policyName.match(/([a-z0-9]+)$/i)?.[1] || policyName);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const initialCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(initialCheck).toBe(false);

        await updateUserAttributes(sharedAdminClient, user.id, {Department: 'Product'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const afterSync = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        if (!afterSync) {
            await sharedAdminClient.addToChannel(user.id, channel.id);
            const afterAdminAdd = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
            expect(afterAdminAdd).toBe(true);
        }

        const finalCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(finalCheck).toBe(true);
    });
});

// ─── MM-T5799: User removed after attribute removed ─────────────────────────

test.describe('ABAC LDAP Integration - Sync - MM-T5799 user removed after attribute removed', () => {
    let sharedAdminClient: any;
    let sharedTeamId: string;
    let systemConsolePage: {page: Page};
    let sharedTestBrowser: TestBrowser | null = null;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(120000);

        const {adminClient, adminUser} = await getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        sharedAdminClient = adminClient;

        try {
            const lic = await adminClient.getClientLicenseOld();
            if (!lic || lic.IsLicensed !== 'true') {
                licensed = false;
                return;
            }
        } catch {
            licensed = false;
            return;
        }

        await ensureUserAttributes(adminClient, ['Department']);

        const suffix = getRandomId();
        const team = await adminClient.createTeam({
            name: `abac-ldap99-${suffix}`,
            display_name: `ABAC-LDAP99 ${suffix}`,
            type: 'O',
        } as any);
        sharedTeamId = team.id;

        sharedTestBrowser = new TestBrowser(browser);
        const loggedIn = await sharedTestBrowser.login(adminUser);
        systemConsolePage = loggedIn.systemConsolePage;
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);
    });

    test.afterAll(async () => {
        await sharedTestBrowser?.close().catch(() => {});
    });

    test('MM-T5799_a user removed with starts-with operator when attribute no longer qualifies', async () => {
        test.setTimeout(120000);
        test.skip(!licensed, 'No ABAC license');

        const user = await createUserWithAttributes(sharedAdminClient, {Department: 'Engineering'});
        await sharedAdminClient.addToTeam(sharedTeamId, user.id);

        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `LDAP Remove StartsWith ${getRandomId()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: 'user.attributes.Department.startsWith("Eng")',
            autoSync: true,
            channels: [channel.display_name],
        });

        await systemConsolePage.page.waitForTimeout(2000);
        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        await searchInput.fill(policyName.match(/([a-z0-9]+)$/i)?.[1] || policyName);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const initialCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(initialCheck).toBe(true);

        await updateUserAttributes(sharedAdminClient, user.id, {Department: 'Sales'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const afterSync = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(afterSync).toBe(false);
    });

    test('MM-T5799_b user removed with = operator when attribute no longer qualifies', async () => {
        test.setTimeout(120000);
        test.skip(!licensed, 'No ABAC license');

        const user = await createUserWithAttributes(sharedAdminClient, {Department: 'Engineering'});
        await sharedAdminClient.addToTeam(sharedTeamId, user.id);

        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `LDAP Remove TwoAttr ${getRandomId()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true,
            channels: [channel.display_name],
        });

        await systemConsolePage.page.waitForTimeout(2000);
        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.fill(policyName.match(/([a-z0-9]+)$/i)?.[1] || policyName);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const initialCheck = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(initialCheck).toBe(true);

        await updateUserAttributes(sharedAdminClient, user.id, {Department: 'Sales'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const afterSync = await verifyUserInChannel(sharedAdminClient, user.id, channel.id);
        expect(afterSync).toBe(false);
    });
});

// ─── MM-T5800: Bidirectional policy enforcement (kept as single test) ───────

test.describe('ABAC LDAP Integration - Sync', () => {
    test('MM-T5800 Policy enforcement after attribute change (bidirectional)', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        await ensureUserAttributes(adminClient);

        const user = await createUserWithAttributes(adminClient, {Department: 'Sales'});
        await adminClient.addToTeam(team.id, user.id);

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        const policyName = `Dynamic Policy ${pw.random.id()}`;
        await createBasicPolicy(systemConsolePage.page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: true,
            channels: [privateChannel.display_name],
        });

        await waitForLatestSyncJob(systemConsolePage.page);
        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.waitFor({state: 'visible', timeout: 5000});
        const idMatch = policyName.match(/([a-z0-9]+)$/i);
        const uniqueId = idMatch ? idMatch[1] : policyName;
        await searchInput.fill(uniqueId);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');

        if (policyId) {
            await activatePolicy(adminClient, policyId);
        }
        await searchInput.clear();

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const phase1InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase1InChannel).toBe(false);

        await updateUserAttributes(adminClient, user.id, {Department: 'Engineering'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const phase2InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase2InChannel).toBe(true);

        await updateUserAttributes(adminClient, user.id, {Department: 'Marketing'});

        await runSyncJob(systemConsolePage.page);
        await waitForLatestSyncJob(systemConsolePage.page);

        const phase3InChannel = await verifyUserInChannel(adminClient, user.id, privateChannel.id);
        expect(phase3InChannel).toBe(false);
    });
});
