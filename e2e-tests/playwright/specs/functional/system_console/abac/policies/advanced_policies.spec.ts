// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    verifyUserInChannel,
    createUserWithAttributes,
    getAdminClient,
    TestBrowser,
    getRandomId,
    type App,
    duration,
} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {
    deleteCustomProfileAttributes,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {waitForAttributeViewToInclude} from '../../../channels/team_settings/helpers';
import {deleteParentPolicy} from '../resource_attributes/helpers';
import {
    ensureUserAttributes,
    createUserForABAC,
    createPrivateChannelForABAC,
    activatePolicy,
    waitForPolicySyncJob,
    enableUserManagedAttributes,
    assertAccessControlAutocompleteContains,
} from '../support';
import {
    createMembershipPolicy,
    expectAccessTest,
    openMembershipPolicies,
    openPolicy,
    policyIdByName,
    runSyncJob,
    setAbacEnabled,
    waitForSyncJob,
} from '../surface';

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
    let createdPolicyId: string | undefined;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(duration.four_min);

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

        // Wait until the server's attribute view has the new users' attributes
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [
            user1.id,
            user2.id,
        ]);

        privateChannel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(user2.id, privateChannel.id);
        await adminClient.addToChannel(user3.id, privateChannel.id);

        // Drive policy creation via the system-console UI exactly once.
        const tb = new TestBrowser(browser);
        const {app} = await tb.login(adminUser);
        await setAbacEnabled(app, true);

        const policyName = `Multi-Attr Policy ${getRandomId()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            cel: 'user.attributes.Department == "Engineering"',
            channels: [privateChannel],
            autoAdd: true,
        });
        const policyId = await policyIdByName(adminClient, policyName);
        createdPolicyId = policyId;

        await activatePolicy(adminClient, policyId);
        await waitForPolicySyncJob(adminClient, policyId);

        // Sync until the qualifying user outside the channel has been added: a sync that runs before the policy is
        // active can leave it out.
        await expect(async () => {
            await waitForSyncJob(adminClient, await runSyncJob(app));
            expect(await verifyUserInChannel(adminClient, user1.id, privateChannel.id)).toBe(true);
        }).toPass({timeout: duration.two_min});
        await tb.close();
    });

    test.afterAll(async () => {
        // The policy list the System Console pages through fills up with policies
        // left behind by earlier runs, and a spec that finds its own policy by
        // scanning that list starts failing once a newer one is off the first page.
        if (createdPolicyId) {
            await deleteParentPolicy(sharedAdminClient, createdPolicyId, [privateChannel?.id].filter(Boolean));
            createdPolicyId = undefined;
        }
    });

    test('MM-T5785_a auto-adds qualifying user who was not in channel', async () => {
        test.setTimeout(duration.one_min);
        test.skip(!licensed, 'No ABAC license');
        await expect
            .poll(async () => verifyUserInChannel(sharedAdminClient, user1.id, privateChannel.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000],
                message: 'user1 should be auto-added to channel',
            })
            .toBe(true);
    });

    test('MM-T5785_b keeps qualifying user who was already in channel', async () => {
        test.setTimeout(duration.one_min);
        test.skip(!licensed, 'No ABAC license');
        await expect
            .poll(async () => verifyUserInChannel(sharedAdminClient, user2.id, privateChannel.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000],
                message: 'user2 should stay in channel',
            })
            .toBe(true);
    });

    test('MM-T5785_c auto-removes non-qualifying user who was in channel', async () => {
        test.setTimeout(duration.one_min);
        test.skip(!licensed, 'No ABAC license');
        await expect
            .poll(async () => verifyUserInChannel(sharedAdminClient, user3.id, privateChannel.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000],
                message: 'user3 should be auto-removed from channel',
            })
            .toBe(false);
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
    test.describe.configure({mode: 'serial'});

    let sharedAdminClient: any;
    let sharedTeamId: string;
    let engineerUser: Awaited<ReturnType<typeof createUserForABAC>>;
    let salesUser: Awaited<ReturnType<typeof createUserForABAC>>;
    let deptFieldName: string;
    let sharedAttributeFieldsMap: Awaited<ReturnType<typeof setupCustomProfileAttributeFields>> | undefined;
    // Policies this describe created, torn down after each test so the paginated
    // policy list does not fill up with them: a spec that finds its own policy by
    // scanning that list starts failing once a newer one is off the first page.
    const policyCleanups: Array<() => Promise<void>> = [];
    let app: App;
    let sharedTestBrowser: TestBrowser | null = null;
    let licensed = true;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(duration.four_min);

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

        const suffix = getRandomId();
        deptFieldName = `MM5786_Dept_${suffix}`;

        const attributeFields: CustomProfileAttribute[] = [
            {name: deptFieldName, type: 'text', value: '', attrs: {managed: 'admin', visibility: 'when_set'}},
        ];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);
        sharedAttributeFieldsMap = attributeFieldsMap;
        await assertAccessControlAutocompleteContains(adminClient, [deptFieldName]);

        engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: deptFieldName, type: 'text', value: 'Engineering'},
        ]);
        salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: deptFieldName, type: 'text', value: 'Sales'},
        ]);

        const teamSuffix = getRandomId();
        const team = await adminClient.createTeam({
            name: `abac-ops-${teamSuffix}`,
            display_name: `ABAC-Ops ${teamSuffix}`,
            type: 'O',
        } as any);
        sharedTeamId = team.id;

        await adminClient.addToTeam(sharedTeamId, engineerUser.id);
        await adminClient.addToTeam(sharedTeamId, salesUser.id);

        sharedTestBrowser = new TestBrowser(browser);
        app = (await sharedTestBrowser.login(adminUser)).app;
        await setAbacEnabled(app, true);
    });

    test.afterEach(async () => {
        for (const cleanup of policyCleanups.reverse()) {
            await cleanup();
        }
        policyCleanups.length = 0;
    });

    test.afterAll(async () => {
        // The access_control group allows at most 20 user-object fields, so fields
        // left behind here eventually fail every later spec's setup rather than this
        // one's. deleteCustomProfileAttributes only removes what this run created,
        // so a field it reused instead survives.
        if (sharedAttributeFieldsMap) {
            await deleteCustomProfileAttributes(sharedAdminClient, sharedAttributeFieldsMap);
            sharedAttributeFieldsMap = undefined;
        }
        await sharedTestBrowser?.close();
    });

    async function runOperatorCase(celExpression: string, namePrefix: string) {
        const channel = await createPrivateChannelForABAC(sharedAdminClient, sharedTeamId);
        await sharedAdminClient.addToChannel(salesUser.id, channel.id);

        const policyName = `${namePrefix} Policy ${getRandomId()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            cel: celExpression.replaceAll('user.attributes.Department', `user.attributes.${deptFieldName}`),
            channels: [channel],
            autoAdd: true,
        });
        const policyId = await policyIdByName(sharedAdminClient, policyName);
        policyCleanups.push(() => deleteParentPolicy(sharedAdminClient, policyId, [channel.id]));

        // * Testing the rule lists the engineer, not the sales user
        await expectAccessTest(app, await openPolicy(app, policyId), {
            client: sharedAdminClient,
            matching: [engineerUser],
            notMatching: [salesUser],
        });

        await activatePolicy(sharedAdminClient, policyId);
        await waitForSyncJob(sharedAdminClient, await runSyncJob(app));

        // Poll under PW_WORKERS>=2: another shard's sync job may interleave.
        await expect
            .poll(async () => verifyUserInChannel(sharedAdminClient, engineerUser.id, channel.id), {
                timeout: duration.two_min,
                intervals: [500, 1000, 2000, 4000],
                message: 'engineerUser should be in channel',
            })
            .toBe(true);
        await expect
            .poll(async () => verifyUserInChannel(sharedAdminClient, salesUser.id, channel.id), {
                timeout: duration.two_min,
                intervals: [500, 1000, 2000, 4000],
                message: 'salesUser should not be in channel',
            })
            .toBe(false);
    }

    test('MM-T5786_a is-not (!=) operator', async () => {
        test.setTimeout(duration.two_min);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department != "Sales"', 'IsNot');
    });

    test('MM-T5786_b in operator', async () => {
        test.setTimeout(duration.two_min);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department in ["Engineering", "DevOps"]', 'In');
    });

    test('MM-T5786_c starts-with operator', async () => {
        test.setTimeout(duration.two_min);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department.startsWith("Eng")', 'StartsWith');
    });

    test('MM-T5786_d ends-with operator', async () => {
        test.setTimeout(duration.two_min);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department.endsWith("ing")', 'EndsWith');
    });

    test('MM-T5786_e contains operator', async () => {
        test.setTimeout(duration.two_min);
        test.skip(!licensed, 'No ABAC license');
        await runOperatorCase('user.attributes.Department.contains("gineer")', 'Contains');
    });
});

/**
 * MM-T5787: Complex CEL expressions with || and grouping ().
 * Kept as a single test because its three verifications are cheap once
 * the single sync-job cycle completes.
 */
test.describe('ABAC Policies - Advanced Policies', () => {
    // Fixtures this test created, torn down afterwards; see the note in the
    // MM-T5786 afterAll for why leaked fields are not a local problem.
    const cleanups: Array<() => Promise<void>> = [];

    test.afterEach(async () => {
        for (const cleanup of cleanups.reverse()) {
            await cleanup();
        }
        cleanups.length = 0;
    });

    test('MM-T5787 Test policy with complex rules in Advanced Mode', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        const idSuffix = pw.random.id();
        const deptFieldName = `MM5787_Dept_${idSuffix}`;
        const locationFieldName = `MM5787_Loc_${idSuffix}`;

        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, [
            {
                name: deptFieldName,
                type: 'text',
                attrs: {managed: 'admin', visibility: 'when_set'},
            },
            {
                name: locationFieldName,
                type: 'text',
                attrs: {managed: 'admin', visibility: 'when_set'},
            },
        ]);
        await assertAccessControlAutocompleteContains(adminClient, [deptFieldName, locationFieldName]);
        cleanups.push(() => deleteCustomProfileAttributes(adminClient, attributeFieldsMap));

        const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: deptFieldName, value: 'Engineering', type: 'text'},
            {name: locationFieldName, value: 'Office', type: 'text'},
        ]);
        const salesRemoteUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: deptFieldName, value: 'Sales', type: 'text'},
            {name: locationFieldName, value: 'Remote', type: 'text'},
        ]);
        const salesOfficeUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: deptFieldName, value: 'Sales', type: 'text'},
            {name: locationFieldName, value: 'Office', type: 'text'},
        ]);

        await adminClient.addToTeam(team.id, engineerUser.id);
        await adminClient.addToTeam(team.id, salesRemoteUser.id);
        await adminClient.addToTeam(team.id, salesOfficeUser.id);

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(salesOfficeUser.id, channel.id);

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        const policyName = `Complex Policy ${pw.random.id()}`;
        const complexExpression = `user.attributes.${deptFieldName} == "Engineering" || (user.attributes.${deptFieldName} == "Sales" && user.attributes.${locationFieldName} == "Remote")`;

        await createMembershipPolicy(app, {
            name: policyName,
            cel: complexExpression,
            channels: [channel],
            autoAdd: true,
        });

        const policyId = await policyIdByName(adminClient, policyName);
        const policies = await openMembershipPolicies(app);
        await policies.searchTextbox.fill(policyName);
        await expect(policies.row(policyId).cell('name')).toBeVisible();
        await expect(policies.row(policyId).cell('name')).toHaveText(policyName);
        cleanups.push(() => deleteParentPolicy(adminClient, policyId, [channel.id]));
        await activatePolicy(adminClient, policyId);
        await waitForSyncJob(adminClient, await runSyncJob(app));

        // Poll under PW_WORKERS>=2: another shard's sync job may interleave.
        await expect
            .poll(async () => verifyUserInChannel(adminClient, engineerUser.id, channel.id), {
                timeout: duration.two_min,
                intervals: [500, 1000, 2000, 4000],
                message: 'engineerUser should be in channel',
            })
            .toBe(true);
        await expect
            .poll(async () => verifyUserInChannel(adminClient, salesRemoteUser.id, channel.id), {
                timeout: duration.two_min,
                intervals: [500, 1000, 2000, 4000],
                message: 'salesRemoteUser should be in channel',
            })
            .toBe(true);
        await expect
            .poll(async () => verifyUserInChannel(adminClient, salesOfficeUser.id, channel.id), {
                timeout: duration.two_min,
                intervals: [500, 1000, 2000, 4000],
                message: 'salesOfficeUser should not be in channel',
            })
            .toBe(false);
    });
});
