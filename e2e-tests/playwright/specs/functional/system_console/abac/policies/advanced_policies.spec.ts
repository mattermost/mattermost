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
    createUserWithAttributes,
    getAdminClient,
    TestBrowser,
    getRandomId,
} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    ensureUserAttributes,
    createUserForABAC,
    testAccessRule,
    createPrivateChannelForABAC,
    createAdvancedPolicy,
    activatePolicy,
    waitForLatestSyncJob,
    getJobDetailsFromRecentJobs,
    enableUserManagedAttributes,
} from '../support';

/**
 * ABAC Policies - Advanced Policies
 *
 * The previous monolithic MM-T5785 and MM-T5786 tests each did 3–5 independent
 * assertions wrapped around one very-expensive sync-job cycle. They are now
 * split into separate `test(...)` blocks — either sharing a single beforeAll
 * (MM-T5785) or split into one-operator-per-test (MM-T5786) so the whole
 * test-file parallelises cleanly under sharding.
 */
test.describe('ABAC Policies - Advanced Policies - MM-T5785 all attribute types (auto-add)', () => {
    let sharedAdminClient: any;
    let user1: Awaited<ReturnType<typeof createUserWithAttributes>>; // qualifying, NOT in channel
    let user2: Awaited<ReturnType<typeof createUserWithAttributes>>; // qualifying, IN channel
    let user3: Awaited<ReturnType<typeof createUserWithAttributes>>; // non-qualifying, IN channel
    let privateChannel: any;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(240000);

        const {adminClient, adminUser} = await getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        sharedAdminClient = adminClient;

        // License gate
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
            name: `abac-${suffix}`,
            display_name: `ABAC ${suffix}`,
            type: 'O',
        } as any);

        // Three users with different attribute combinations
        user1 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
        user2 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
        user3 = await createUserWithAttributes(adminClient, {Department: 'Sales'});

        await adminClient.addToTeam(team.id, user1.id);
        await adminClient.addToTeam(team.id, user2.id);
        await adminClient.addToTeam(team.id, user3.id);

        // Attribute indexing settle
        await new Promise((resolve) => setTimeout(resolve, 2000));

        privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(user2.id, privateChannel.id);
        await adminClient.addToChannel(user3.id, privateChannel.id);

        // Drive policy creation via the system-console UI exactly once.
        const tb = new TestBrowser(browser);
        try {
            const {systemConsolePage} = await tb.login(adminUser);
            await navigateToABACPage(systemConsolePage.page);
            await enableABAC(systemConsolePage.page);

            const policyName = `Multi-Attr Policy ${getRandomId()}`;
            const celExpression = 'user.attributes.Department == "Engineering"';

            await createAdvancedPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression,
                autoSync: true,
                channels: [privateChannel.display_name],
            });

            await systemConsolePage.page.waitForTimeout(1000);
            const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
            await searchInput.waitFor({state: 'visible', timeout: 5000});
            const idMatch = policyName.match(/([a-z0-9]+)$/i);
            const uniqueId = idMatch ? idMatch[1] : policyName;
            await searchInput.fill(uniqueId);
            await systemConsolePage.page.waitForTimeout(1000);

            const policyRow = systemConsolePage.page.locator('.policy-name').first();
            const policyElementId = await policyRow.getAttribute('id');
            const policyId = policyElementId?.replace('customDescription-', '');
            if (!policyId) {
                throw new Error('Could not get policy ID');
            }
            await searchInput.clear();

            await activatePolicy(adminClient, policyId);
            await waitForLatestSyncJob(systemConsolePage.page, 10);
            const __jobId1 = await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page, 10, __jobId1);

            try {
                await getJobDetailsFromRecentJobs(systemConsolePage.page, privateChannel.display_name);
            } catch {
                // non-fatal
            }

            // Optional extra sync if user1 not added yet
            const added = await verifyUserInChannel(adminClient, user1.id, privateChannel.id);
            if (!added) {
                const __jobId2 = await runSyncJob(systemConsolePage.page);
                await waitForLatestSyncJob(systemConsolePage.page, 10, __jobId2);
                await systemConsolePage.page.waitForTimeout(2000);
            }
        } finally {
            await tb.close().catch(() => {});
        }
    });

    test('MM-T5785_a auto-adds qualifying user who was not in channel', async () => {
        test.setTimeout(60000);
        test.skip(!licensed, 'No ABAC license');
        const inChannel = await verifyUserInChannel(sharedAdminClient, user1.id, privateChannel.id);
        expect(inChannel).toBe(true);
    });

    test('MM-T5785_b keeps qualifying user who was already in channel', async () => {
        test.setTimeout(60000);
        test.skip(!licensed, 'No ABAC license');
        const inChannel = await verifyUserInChannel(sharedAdminClient, user2.id, privateChannel.id);
        expect(inChannel).toBe(true);
    });

    test('MM-T5785_c auto-removes non-qualifying user who was in channel', async () => {
        test.setTimeout(60000);
        test.skip(!licensed, 'No ABAC license');
        const inChannel = await verifyUserInChannel(sharedAdminClient, user3.id, privateChannel.id);
        expect(inChannel).toBe(false);
    });
});

/**
 * MM-T5786: Attribute-based access policy using operator variations in Simple mode.
 *
 * Splits the original test's 5 operator sequences into 5 independent tests
 * that share a single beforeAll (which creates the shared team, attributes,
 * engineer/sales users, and admin-logged-in system-console page). Each
 * operator then adds its own channel + policy and verifies independently.
 *
 * Tests run serially within the same worker for this file, so mutations on
 * the shared page don't race.
 */
test.describe('ABAC Policies - Advanced Policies - MM-T5786 operator variants', () => {
    let sharedAdminClient: any;
    let sharedTeamId: string;
    let engineerUser: Awaited<ReturnType<typeof createUserForABAC>>;
    let salesUser: Awaited<ReturnType<typeof createUserForABAC>>;
    let systemConsolePage: {page: Page};
    let sharedTestBrowser: TestBrowser | null = null;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(180000);

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

        await enableUserManagedAttributes(adminClient);

        // Clean slate for attributes so the Department text field is the only one.
        try {
            const existingFields = await adminClient.getCustomProfileAttributeFields();
            for (const field of existingFields || []) {
                await adminClient.deleteCustomProfileAttributeField(field.id).catch(() => {});
            }
        } catch {
            // ignore
        }

        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        const suffix = getRandomId();
        const team = await adminClient.createTeam({
            name: `abac-ops-${suffix}`,
            display_name: `ABAC-Ops ${suffix}`,
            type: 'O',
        } as any);
        sharedTeamId = team.id;

        await adminClient.addToTeam(sharedTeamId, engineerUser.id);
        await adminClient.addToTeam(sharedTeamId, salesUser.id);

        sharedTestBrowser = new TestBrowser(browser);
        const loggedIn = await sharedTestBrowser.login(adminUser);
        systemConsolePage = loggedIn.systemConsolePage;
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);
    });

    test.afterAll(async () => {
        await sharedTestBrowser?.close().catch(() => {});
    });

    async function runOperatorCase(celExpression: string, namePrefix: string, searchTerm: string) {
        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);
        await sharedAdminClient.addToChannel(salesUser.id, channel.id);

        await navigateToABACPage(systemConsolePage.page);

        const policyName = `${namePrefix} Policy ${getRandomId()}`;
        await createAdvancedPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression,
            autoSync: true,
            channels: [channel.display_name],
        });

        await systemConsolePage.page.waitForTimeout(1000);
        const policyRowForTest = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
        if (await policyRowForTest.isVisible({timeout: 3000})) {
            await policyRowForTest.click();
            await systemConsolePage.page.waitForLoadState('networkidle');
            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username],
                expectedNonMatchingUsers: [salesUser.username],
            });
            await navigateToABACPage(systemConsolePage.page);
        }

        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        await searchInput.fill(searchTerm);
        await systemConsolePage.page.waitForTimeout(1000);
        const policyRow = systemConsolePage.page.locator('.policy-name').first();
        const policyId = (await policyRow.getAttribute('id'))?.replace('customDescription-', '');
        if (policyId) {
            await activatePolicy(sharedAdminClient, policyId);
            const __jobId3 = await runSyncJob(systemConsolePage.page);
            await waitForLatestSyncJob(systemConsolePage.page, 15, __jobId3);
        }
        await searchInput.clear();

        const engInChannel = await verifyUserInChannel(sharedAdminClient, engineerUser.id, channel.id);
        const salesInChannel = await verifyUserInChannel(sharedAdminClient, salesUser.id, channel.id);
        expect(engInChannel).toBe(true);
        expect(salesInChannel).toBe(false);
    }

    test('MM-T5786_a is-not (!=) operator', async () => {
        test.setTimeout(90000);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department != "Sales"', 'IsNot', 'IsNot');
    });

    test('MM-T5786_b in operator', async () => {
        test.setTimeout(90000);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department in ["Engineering", "DevOps"]', 'In', 'In Policy');
    });

    test('MM-T5786_c starts-with operator', async () => {
        test.setTimeout(90000);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department.startsWith("Eng")', 'StartsWith', 'StartsWith');
    });

    test('MM-T5786_d ends-with operator', async () => {
        test.setTimeout(90000);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department.endsWith("ing")', 'EndsWith', 'EndsWith');
    });

    test('MM-T5786_e contains operator', async () => {
        test.setTimeout(90000);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department.contains("gineer")', 'Contains', 'Contains');
    });
});

/**
 * MM-T5787: Complex CEL expressions with || and grouping ().
 * Kept as a single test because its three verifications are cheap once
 * the single sync-job cycle completes.
 */
test.describe('ABAC Policies - Advanced Policies', () => {
    test('MM-T5787 Test policy with complex rules in Advanced Mode', async ({pw}) => {
        test.setTimeout(120000);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        try {
            const existingFields = await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/custom_profile_attributes/fields`,
                {method: 'GET'},
            );
            for (const field of existingFields || []) {
                try {
                    await adminClient.deleteCustomProfileAttributeField(field.id);
                } catch {
                    // Ignore deletion errors
                }
            }
        } catch {
            // Ignore errors
        }

        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {name: 'Department', type: 'text'},
            {name: 'Location', type: 'text'},
        ]);

        Object.keys(attributeFieldsMap);

        const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Engineering', type: 'text'},
            {name: 'Location', value: 'Office', type: 'text'},
        ]);
        const salesRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
            {name: 'Location', value: 'Remote', type: 'text'},
        ]);
        const salesOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', value: 'Sales', type: 'text'},
            {name: 'Location', value: 'Office', type: 'text'},
        ]);

        await adminClient.addToTeam(team.id, engineerUser.id);
        await adminClient.addToTeam(team.id, salesRemoteUser.id);
        await adminClient.addToTeam(team.id, salesOfficeUser.id);

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesOfficeUser.id, channel.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(systemConsolePage.page);
        await enableABAC(systemConsolePage.page);

        await systemConsolePage.page.reload();
        await systemConsolePage.page.waitForLoadState('networkidle');

        const policyName = `Complex Policy ${pw.random.id()}`;
        const complexExpression =
            'user.attributes.Department == "Engineering" || (user.attributes.Department == "Sales" && user.attributes.Location == "Remote")';

        await createAdvancedPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: complexExpression,
            autoSync: true,
            channels: [channel.display_name],
        });

        await navigateToABACPage(systemConsolePage.page);
        await systemConsolePage.page.waitForTimeout(1000);

        const policyRow = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
        if (await policyRow.isVisible({timeout: 5000})) {
            await policyRow.click();
            await systemConsolePage.page.waitForLoadState('networkidle');

            await testAccessRule(systemConsolePage.page, {
                expectedMatchingUsers: [engineerUser.username, salesRemoteUser.username],
                expectedNonMatchingUsers: [salesOfficeUser.username],
            });

            await navigateToABACPage(systemConsolePage.page);
        }

        await waitForLatestSyncJob(systemConsolePage.page);

        const searchInput = systemConsolePage.page.locator('input[placeholder*="Search" i]').first();
        const policyIdMatch = policyName.match(/([a-z0-9]+)$/i);
        const searchTerm = policyIdMatch ? policyIdMatch[1] : policyName;

        await searchInput.fill(searchTerm);
        await systemConsolePage.page.waitForTimeout(1000);

        const foundPolicy = systemConsolePage.page.locator('.policy-name').filter({hasText: policyName}).first();
        if (await foundPolicy.isVisible({timeout: 5000})) {
            const policyId = (await foundPolicy.getAttribute('id'))?.replace('customDescription-', '');
            if (policyId) {
                await activatePolicy(adminClient, policyId);
                const __jobId4 = await runSyncJob(systemConsolePage.page);
                await waitForLatestSyncJob(systemConsolePage.page, 5, __jobId4);
            }
        } else {
            await systemConsolePage.page.locator('.policy-name').allTextContents();
        }
        await searchInput.clear();

        const engineerInChannel = await verifyUserInChannel(adminClient, engineerUser.id, channel.id);
        expect(engineerInChannel).toBe(true);

        const salesRemoteInChannel = await verifyUserInChannel(adminClient, salesRemoteUser.id, channel.id);
        expect(salesRemoteInChannel).toBe(true);

        const salesOfficeInChannel = await verifyUserInChannel(adminClient, salesOfficeUser.id, channel.id);
        expect(salesOfficeInChannel).toBe(false);
    });
});
