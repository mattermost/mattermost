// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    verifyUserInChannel,
    updateUserAttributes,
    createUserWithAttributes,
    duration,
} from '@mattermost/playwright-lib';

import {
    ensureUserAttributes,
    createPrivateChannelForABAC,
    activatePolicy,
    getUserAttributeFieldByName,
} from '../support';
import {createMembershipPolicy, policyIdByName, runSyncJob, setAbacEnabled, waitForSyncJob} from '../surface';

/**
 * MM-T5799b: LDAP sync - User removed after attribute removed (== operator, auto-add true)
 */
test('MM-T5799b LDAP sync - User removed with == operator (auto-add true)', async ({pw}) => {
    test.setTimeout(duration.two_min);

    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    await ensureUserAttributes(adminClient, ['Department']);

    // User starts WITH qualifying attribute.
    const user2 = await createUserWithAttributes(adminClient, {Department: 'Engineering'});
    await adminClient.addToTeam(team.id, user2.id);

    const channel2 = await createPrivateChannelForABAC(adminClient, team.id);

    const {app} = await pw.testBrowser.login(adminUser);

    await setAbacEnabled(app, true);

    const policy2Name = `LDAP Remove TwoAttr ${pw.random.id()}`;
    await createMembershipPolicy(app, {
        name: policy2Name,
        rules: [{field: await getUserAttributeFieldByName(adminClient, 'Department'), value: 'Engineering'}],
        channels: [channel2],
        autoAdd: true,
    });
    const t5799Policy2Id = await policyIdByName(adminClient, policy2Name);

    await activatePolicy(adminClient, t5799Policy2Id);

    // Sync: user has qualifying attribute → gets auto-added.
    // Capture exact job ID so we poll the right job, not the most-recent row
    // (which may belong to a concurrent shard's sync job under PW_WORKERS >= 2).
    await waitForSyncJob(adminClient, await runSyncJob(app));

    await expect
        .poll(() => verifyUserInChannel(adminClient, user2.id, channel2.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'User should have been added to channel after first sync',
        })
        .toBe(true);

    // Change Department to non-qualifying value.
    await updateUserAttributes(adminClient, user2.id, {Department: 'Sales'});

    // Sync: user no longer qualifies → gets removed.
    await waitForSyncJob(adminClient, await runSyncJob(app));

    await expect
        .poll(() => verifyUserInChannel(adminClient, user2.id, channel2.id), {
            timeout: duration.half_min,
            intervals: [500, 1000, 2000],
            message: 'User should have been removed from channel after second sync',
        })
        .toBe(false);
});
