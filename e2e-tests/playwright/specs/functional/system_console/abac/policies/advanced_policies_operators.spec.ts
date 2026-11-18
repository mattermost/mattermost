// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel, duration} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {waitForAttributeViewToInclude} from '../../../channels/team_settings/helpers';
import {
    ensureUserAttributes,
    createUserForABAC,
    createPrivateChannelForABAC,
    activatePolicy,
    waitForPolicySyncJob,
} from '../support';
import {createMembershipPolicy, expectAccessTest, openPolicy, policyIdByName, runSyncJob} from '../surface';

/**
 * MM-T5786 (1/5): "is not" (!=) operator — Department != "Sales" with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "is not" (!=) operator in Simple mode', async ({pw}) => {
    test.setTimeout(duration.two_min);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

    const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
    ]);
    const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
    ]);
    await adminClient.addToTeam(team.id, engineerUser.id);
    await adminClient.addToTeam(team.id, salesUser.id);

    const {app} = await pw.testBrowser.login(adminUser);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    await ensureUserAttributes(adminClient);
    const policyName = `IsNot Policy ${pw.random.id()}`;
    await createMembershipPolicy(app, {
        name: policyName,
        cel: 'user.attributes.Department != "Sales"',
        channels: [channel],
        autoAdd: true,
    });
    const policyId = await policyIdByName(adminClient, policyName);

    await expectAccessTest(app, await openPolicy(app, policyId), {
        client: adminClient,
        matching: [engineerUser],
        notMatching: [salesUser],
    });

    await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department != "Sales"', [engineerUser.id]);
    await activatePolicy(adminClient, policyId);
    await runSyncJob(app);
    await waitForPolicySyncJob(adminClient, policyId);

    await expect
        .poll(() => verifyUserInChannel(adminClient, engineerUser.id, channel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerUser should be in channel after sync',
        })
        .toBe(true);
    expect(await verifyUserInChannel(adminClient, salesUser.id, channel.id)).toBe(false);
});

/**
 * MM-T5786 (2/5): "in" operator — Department in ["Engineering", "DevOps"] with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "in" operator in Simple mode', async ({pw}) => {
    test.setTimeout(duration.two_min);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

    const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
    ]);
    const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
    ]);
    await adminClient.addToTeam(team.id, engineerUser.id);
    await adminClient.addToTeam(team.id, salesUser.id);

    const {app} = await pw.testBrowser.login(adminUser);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    await ensureUserAttributes(adminClient);
    const policyName = `In Policy ${pw.random.id()}`;
    await createMembershipPolicy(app, {
        name: policyName,
        cel: 'user.attributes.Department in ["Engineering", "DevOps"]',
        channels: [channel],
        autoAdd: true,
    });
    const policyId = await policyIdByName(adminClient, policyName);

    await expectAccessTest(app, await openPolicy(app, policyId), {
        client: adminClient,
        matching: [engineerUser],
        notMatching: [salesUser],
    });

    await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department in ["Engineering", "DevOps"]', [
        engineerUser.id,
    ]);
    await activatePolicy(adminClient, policyId);
    await runSyncJob(app);
    await waitForPolicySyncJob(adminClient, policyId);

    await expect
        .poll(() => verifyUserInChannel(adminClient, engineerUser.id, channel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerUser should be in channel after sync',
        })
        .toBe(true);
    expect(await verifyUserInChannel(adminClient, salesUser.id, channel.id)).toBe(false);
});

/**
 * MM-T5786 (3/5): "starts with" operator — Department.startsWith("Eng") with auto-add
 *
 * @reference https://github.com/mattermost/mattermost-test-management/blob/main/data/test-cases/channels/abac-attribute-based-access/abac-system-admin/MM-T5786.md
 */
test('MM-T5786 Test "starts with" operator in Simple mode', async ({pw}) => {
    test.setTimeout(duration.two_min);
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();

    const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
    const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

    const engineerUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Engineering'},
    ]);
    const salesUser = await createUserForABAC(adminClient, attributeFieldsMap, [
        {name: 'Department', type: 'text', value: 'Sales'},
    ]);
    await adminClient.addToTeam(team.id, engineerUser.id);
    await adminClient.addToTeam(team.id, salesUser.id);

    const {app} = await pw.testBrowser.login(adminUser);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(salesUser.id, channel.id);

    await ensureUserAttributes(adminClient);
    const policyName = `StartsWith Policy ${pw.random.id()}`;
    await createMembershipPolicy(app, {
        name: policyName,
        cel: 'user.attributes.Department.startsWith("Eng")',
        channels: [channel],
        autoAdd: true,
    });
    const policyId = await policyIdByName(adminClient, policyName);

    await expectAccessTest(app, await openPolicy(app, policyId), {
        client: adminClient,
        matching: [engineerUser],
        notMatching: [salesUser],
    });

    await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department.startsWith("Eng")', [engineerUser.id]);
    await activatePolicy(adminClient, policyId);
    await runSyncJob(app);
    await waitForPolicySyncJob(adminClient, policyId);

    await expect
        .poll(() => verifyUserInChannel(adminClient, engineerUser.id, channel.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'engineerUser should be in channel after sync',
        })
        .toBe(true);
    expect(await verifyUserInChannel(adminClient, salesUser.id, channel.id)).toBe(false);
});
