// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test, verifyUserInChannel} from '@mattermost/playwright-lib';

import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    createPrivateChannelForABAC,
    createUserForABAC,
    enableUserManagedAttributes,
    waitForPolicySyncJob,
} from '../support';

import {
    createChannelTextField,
    createParentPolicyViaAPI,
    openPolicyEditor,
    setChannelAttributeValue,
    triggerSyncJob,
} from './helpers';

/**
 * All-channels toggle + global auto-add (Phase 15) driven through the policy
 * editor UI.
 *
 * Selecting "All channels" marks the parent applies_to_all_channels + active,
 * which governs every eligible private channel by materializing a per-channel
 * child. Enforcement (remove non-matching, block joins) runs off the child
 * existing; auto-add is a SEPARATE global switch, default off. This asserts the
 * distinction over the real UI:
 *  - All channels ON, auto-add OFF: a non-matching member is removed, a matching
 *    member stays, but a matching team-only user is NOT pulled in.
 *  - auto-add flipped ON: the matching team-only user is now auto-added.
 *
 * DESTRUCTIVE: an active all-channels parent governs EVERY eligible private
 * channel in the install, so this must run isolated (@abac_all_channels) and
 * deletes the policy in finally (cascading removal of its materialized children).
 *
 * The attribute materialized view refreshes on a throttled (~30s) cadence, so a
 * sync run just after values change can read a stale snapshot; the membership
 * assertions re-trigger the sync until the view catches up.
 */
test.describe('ABAC resource.attributes - all-channels toggle', {tag: ['@abac', '@abac_all_channels']}, () => {
    test('All-channels enforces immediately; global auto-add gates adds off then on', async ({pw}) => {
        test.setTimeout(240000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        const attr = `region${pw.random.id()}`;
        const fieldsMap = await setupCustomProfileAttributeFields(adminClient, [{name: attr, type: 'text', value: ''}]);
        const channelFieldId = await createChannelTextField(adminClient, attr);

        const matchingMember = await createUserForABAC(adminClient, fieldsMap, [
            {name: attr, type: 'text', value: 'us'},
        ]);
        const nonMatchingMember = await createUserForABAC(adminClient, fieldsMap, [
            {name: attr, type: 'text', value: 'eu'},
        ]);
        const matchingTeamOnly = await createUserForABAC(adminClient, fieldsMap, [
            {name: attr, type: 'text', value: 'us'},
        ]);
        for (const u of [matchingMember, nonMatchingMember, matchingTeamOnly]) {
            await adminClient.addToTeam(team.id, u.id);
        }

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await setChannelAttributeValue(adminClient, channel.id, channelFieldId, 'us');
        await adminClient.addToChannel(matchingMember.id, channel.id);
        await adminClient.addToChannel(nonMatchingMember.id, channel.id);

        // Parent is created inert (no channels, not all-channels) — the UI flips it
        // to all-channels, which is the feature under test.
        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `AllChannelsToggle ${pw.random.id()}`,
            expression: `user.attributes.${attr} == resource.attributes.${attr}`,
        });

        // Re-trigger a sync and snapshot governed membership. Re-triggering lets a
        // stale matview refresh across the ~30s throttle before we assert.
        const syncAndSnapshot = async () => {
            await triggerSyncJob(adminClient, policyId);
            await waitForPolicySyncJob(adminClient, policyId, 90000);
            return {
                matching: await verifyUserInChannel(adminClient, matchingMember.id, channel.id),
                nonMatching: await verifyUserInChannel(adminClient, nonMatchingMember.id, channel.id),
                teamOnly: await verifyUserInChannel(adminClient, matchingTeamOnly.id, channel.id),
            };
        };

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await openPolicyEditor(page, policyId);

            // Select "All channels" (auto-add stays off).
            const allChannelsRadio = page
                .locator('.AccessControlPolicySettings__channelScopeOption')
                .filter({hasText: 'All channels'})
                .locator('input[type="radio"]');
            await allChannelsRadio.check();

            // Info notice naming the referenced channel attribute (Decision F).
            await expect(page.getByText('This policy depends on channel attributes')).toBeVisible({timeout: 10000});

            await saveAndApply(page);

            // The channel is now governed: its child materialized and enforcement
            // flipped policy_enforced on.
            await expect
                .poll(async () => (await adminClient.getChannel(channel.id)).policy_enforced, {
                    timeout: 30000,
                    intervals: [1000],
                })
                .toBe(true);

            // Auto-add OFF: enforcement removes the non-matching member and keeps
            // the matching one, but the matching team-only user is NOT added.
            await expect
                .poll(async () => JSON.stringify(await syncAndSnapshot()), {
                    timeout: 150000,
                    intervals: [2000],
                })
                .toBe(JSON.stringify({matching: true, nonMatching: false, teamOnly: false}));

            // Saving navigates back to the policy list, so re-open the editor to
            // flip the global auto-add switch ON.
            await openPolicyEditor(page, policyId);
            const autoAddCheckbox = page.locator('.AccessControlPolicySettings__autoAddToggle input[type="checkbox"]');
            await expect(autoAddCheckbox).toBeVisible({timeout: 10000});
            await autoAddCheckbox.check();
            await saveAndApply(page);

            // Auto-add ON: the matching team-only user is now pulled in.
            await expect
                .poll(async () => (await syncAndSnapshot()).teamOnly, {
                    timeout: 150000,
                    intervals: [2000],
                })
                .toBe(true);
        } finally {
            try {
                await adminClient.deleteAccessControlPolicy(policyId);
            } catch {
                // best-effort: bound the blast radius even if the test failed
            }
        }
    });
});

// Save the policy and confirm the all-channels blast-radius modal ("Apply policy").
// Returns after the editor navigates back to the policy list.
async function saveAndApply(page: Page): Promise<void> {
    const saveButton = page.locator('.admin-console-save').getByRole('button', {name: 'Save'});
    await expect(saveButton).toBeEnabled({timeout: 10000});
    await saveButton.click();

    const applyButton = page.getByRole('button', {name: /apply policy/i});
    await expect(applyButton).toBeVisible({timeout: 10000});
    await applyButton.click();
    await page.waitForLoadState('networkidle');
}
