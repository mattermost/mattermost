// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * A scheduled burn-on-read post allowed by policy is delivered as burn-on-read when the
 * send job fires.
 *
 * Nothing else covers this. Every scheduled-post test in burn_on_read_edge_cases.spec.ts
 * schedules two days out precisely so the job cannot run, and the Go tests stop at the API
 * boundary. This is the only place that proves the happy path end to end.
 *
 * It matters because the send path is not the create path. api4 enforces the policy in
 * postBurnOnReadCheckWithContext; the job calls the layer below it,
 * PostBurnOnReadCheckWithApp (channels/app/scheduled_post_job.go), on a
 * request.EmptyContext with no session at all. A post that was allowed when it was
 * scheduled has to still send.
 */

import type {Client4} from '@mattermost/client';

import {expect, getRandomId, licenseTier, openChannel, test, DefaultChannel} from '@mattermost/playwright-lib';

import {lastPost} from '../../../channels/burn_on_read/support';
import {createUserForABAC} from '../support';

import {
    deletePolicyById,
    grantToEmailCEL,
    ensureABACEnabled,
    requireFeatureFlag,
    scheduleBurnOnReadPostInPage,
    ensureBurnOnReadEnabled,
    upsertSystemPolicy,
} from './helpers';

let systemPolicyId = '';
let savedAdminClient: Client4 | undefined;

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    test.skip(licenseTier(license.SkuShortName) < 30, 'Burn-on-read requires an Enterprise Advanced licence.');
    await requireFeatureFlag(pw, 'PermissionPolicies');

    // This test has to watch the send job actually run, and without EnableTesting that is
    // not a slow test — it is an impossible one. doRunScheduledPostJob (channels/app/server.go)
    // uses a 5 minute interval instead of 2 seconds, and CreateRecurringTaskFromNextIntervalTime
    // aligns the first tick to the next wall-clock multiple of the interval, so delivery can
    // be a full 5 minutes away. Skip with a clear reason rather than spend minutes failing.
    // Read at boot when the recurring task is created, so patching it here would not help.
    const config = await adminClient.getConfig();
    test.skip(
        config.ServiceSettings?.EnableTesting !== true,
        'Requires ServiceSettings.EnableTesting=true in the server boot environment, which drops the scheduled-post job interval from 5 minutes to 2 seconds.',
    );
});

test.afterEach(async () => {
    if (savedAdminClient) {
        await deletePolicyById(savedAdminClient, systemPolicyId);
        await ensureBurnOnReadEnabled(savedAdminClient);
    }
    systemPolicyId = '';
});

/**
 * @objective Verify a burn-on-read post scheduled by a policy-allowed user is delivered as a
 * burn-on-read post once the schedule fires.
 *
 * The assertion is on the badge, not on the text arriving: a post whose type was dropped
 * somewhere on the send path still arrives, and still contains the message, and would pass
 * a text-only check while having silently become permanent — the worst available failure
 * for a self-deleting message.
 *
 * @precondition
 * ServiceSettings.EnableTesting=true in the server's boot environment; the beforeEach skips
 * without it.
 */
test(
    'delivers a policy-allowed scheduled burn-on-read post as burn-on-read when it fires',
    {tag: '@abac_burn_on_read'},
    async ({pw}) => {
        // The job ticks every 2s here (the beforeEach skips otherwise), so delivery lands a
        // few seconds after the scheduled time. The headroom is for a loaded CI runner, not
        // for a slow job.
        test.setTimeout(pw.duration.four_min);

        const {adminClient, team, townSquare} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        const user = await createUserForABAC(adminClient, {}, []);
        await adminClient.addToTeam(team.id, user.id);

        // # Allow the action for this user
        systemPolicyId = await upsertSystemPolicy(adminClient, {
            name: `BoR Scheduled ${getRandomId()}`,
            expression: grantToEmailCEL(user.email),
        });
        await ensureABACEnabled(adminClient);

        const app = await openChannel(pw, user, {team, channel: townSquare});

        // * Verify the composer agrees the user may create one, so a later failure points
        // at the send path rather than at the grant
        await expect(app.center.postCreate.burnOnReadButton).toBeVisible();

        // # Schedule a burn-on-read post for a few seconds out. Through the API rather
        // than the schedule-message modal, whose slots are half-hourly; the server accepts
        // any time down to 5s in the past.
        const channel = await adminClient.getChannelByName(team.id, DefaultChannel.TownSquare);
        const message = `bor scheduled ${getRandomId()}`;
        const scheduled = await scheduleBurnOnReadPostInPage(app.page, {
            channelId: channel.id,
            message,
            scheduledAt: Date.now() + pw.duration.four_sec,
        });

        // * Verify the schedule was accepted, so a missing post later means the job failed
        // to deliver rather than that nothing was ever queued
        expect(scheduled.status, `scheduling rejected: ${JSON.stringify(scheduled.body)}`).toBe(201);
        expect(scheduled.body.type).toBe('burn_on_read');

        // # Wait for the send job to deliver it. A burn-on-read post shows its sender the
        // message, so the text is there once it arrives.
        // Deliberately shorter than the test timeout, so exhausting it fails here —
        // "the job never delivered" — rather than as an unattributed test timeout.
        // The post-body container has no text-reading driver; include the burn-on-read wrapper's content.
        await expect
            .poll(async () => (await lastPost(app)).post.body.locator.textContent(), {
                timeout: pw.duration.two_min,
                intervals: [pw.duration.two_sec],
            })
            .toContain(message);

        // * Verify it arrived as a burn-on-read post, not as a permanent one
        const {post} = await lastPost(app);
        await expect(post.burnOnReadButton).toBeVisible();
    },
);
