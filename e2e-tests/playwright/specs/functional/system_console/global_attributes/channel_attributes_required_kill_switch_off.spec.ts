// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The ChannelAttributesRequired feature flag, OFF (the server default).
 *
 * Every test in this file runs under the same {ChannelAttributes: true,
 * ChannelAttributesRequired: false} configuration — see the companion "on" spec,
 * channel_attributes_required_kill_switch_on.spec.ts, for the flag turned on. Splitting
 * by flag combination, one ensureFeatureFlag call per file in a single top-level
 * beforeAll, keeps each file to at most one Testcontainers server restart.
 *
 * The grandfather scenario the kill switch exists for — a channel field marked
 * required while enforcement was on keeps that attr, inert, after enforcement is
 * turned off — is NOT covered here. Exercising it would require the flag to flip
 * from on to off within a single test (the server refuses to ever write
 * attrs.required on a channel field while enforcement is off, even via a direct
 * API call: see newRequiredAttrDisabledError in
 * server/channels/app/properties/access_control_attribute_validation.go), which
 * is exactly the multi-restart-per-file pattern this split is meant to avoid.
 * That transition is pinned far more cheaply at the unit level instead, by
 * TestAccessControlAttributeValidationHookRequiredAttrCreationGuard in
 * server/channels/app/properties/access_control_attribute_validation_test.go,
 * which flips enforcement with a plain bool and needs no server restart at all.
 */

import {ensureFeatureFlag, expect, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';

test.describe(
    'System Console - ChannelAttributesRequired feature flag (off)',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        // The "page"/"context" fixtures that `pw` depends on are per-test, not available in
        // beforeAll, so the restart must go through the bare import instead of pw.ensureFeatureFlag.
        test.beforeAll(async () => {
            await ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: false});
        });

        /**
         * @objective Ensure the System Console hides the Required toggle for a
         * channel-resource attribute when ChannelAttributesRequired is off — there is
         * no admin path to freshly mark a field required while enforcement is disabled.
         */
        test('hides the Required toggle for channel attributes when ChannelAttributesRequired is off', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await globalAttributes.gotoNewAttribute();
            await globalAttributes.setDisplayName(`Required Toggle Off ${suffix}`);
            await attributeAppliesToChannels.addResource();

            // * Required toggle hidden — enforcement is off, no admin path to mark required
            await expect(attributeAppliesToChannels.requiredToggle).toHaveCount(0);

            // The form was never saved, so there is no attribute field to clean up.
        });
    },
);
