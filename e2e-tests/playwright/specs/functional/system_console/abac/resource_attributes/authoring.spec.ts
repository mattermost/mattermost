// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';
import {enableTeamMembershipPolicies} from '../teams/helpers';

import {
    createChannelTextField,
    createParentPolicyViaAPI,
    deleteParentPolicy,
    deletePropertyFieldQuietly,
    expectAssignTeamsDenied,
} from './helpers';

/**
 * Authoring round-trip for resource.attributes.* over the real HTTP boundary
 * (Playwright drives a live server with the enterprise engine, so SavePolicy /
 * cel-check validation runs for real — the api4 Go tests mock the engine and
 * cannot).
 *
 * One representative case per rule; the exhaustive save-validation matrix
 * (multiselect reject, rank scale-match, permission-policy accept) lives in the
 * enterprise engine unit tests.
 */
test.describe('ABAC resource.attributes - authoring', {tag: ['@abac', '@abac_resource_attributes']}, () => {
    // Fixtures this file created, torn down after each test. The access_control group
    // allows at most 20 user-object fields, so a spec that leaks its fields eventually
    // fails every later spec's setup rather than its own.
    const cleanups: Array<() => Promise<void>> = [];

    test.afterEach(async () => {
        // Reverse order, so a policy goes before the fields its rules reference: while
        // attribute-value masking is on, deleting a policy whose field is already gone
        // is refused outright and the policy can no longer be removed at all.
        for (const cleanup of cleanups.reverse()) {
            await cleanup().catch(() => {});
        }
        cleanups.length = 0;
    });

    test('accepts a parent policy mixing user and resource attributes', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        const attr = `region${pw.random.id()}`;
        const channelFieldId = await createChannelTextField(adminClient, attr);
        cleanups.push(() => deletePropertyFieldQuietly(adminClient, 'channel', channelFieldId));

        // Save succeeds and returns a policy id — the round-trip accepts a
        // mixed user/resource expression on a parent policy.
        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `Accept Resource ${pw.random.id()}`,
            expression: `resource.attributes.${attr} == "us"`,
        });
        expect(policyId).toBeTruthy();
        cleanups.push(() => deleteParentPolicy(adminClient, policyId));
    });

    test('rejects has(resource.attributes.*) at check time', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as Parameters<typeof adminClient.patchConfig>[0]);

        const attr = `region${pw.random.id()}`;
        const channelFieldId = await createChannelTextField(adminClient, attr);
        cleanups.push(() => deletePropertyFieldQuietly(adminClient, 'channel', channelFieldId));

        // Absence is handled by deny-on-miss, so has() guards on resource
        // attributes are rejected. cel/check surfaces the error to the editor.
        // Assert the reason, not just that validation failed: a bare count also
        // passes on an unrelated compile or engine error, and would have kept
        // passing while the feature flag denied every resource reference.
        const errors = await adminClient.checkAccessControlExpression(`has(resource.attributes.${attr})`);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain('has() is not supported on resource attributes');
    });

    test('rejects assigning a resource parent to a team', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ResourceAttributesInPolicies', true);

        const {adminClient, team} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        await enableTeamMembershipPolicies(adminClient);

        const attr = `region${pw.random.id()}`;
        const channelFieldId = await createChannelTextField(adminClient, attr);
        cleanups.push(() => deletePropertyFieldQuietly(adminClient, 'channel', channelFieldId));

        const policyId = await createParentPolicyViaAPI(adminClient, {
            name: `Team Boundary ${pw.random.id()}`,
            expression: `resource.attributes.${attr} == "us"`,
        });

        cleanups.push(() => deleteParentPolicy(adminClient, policyId));

        // A team's resource is a team, which has no CPA attributes, so a parent
        // that references resource.attributes.* must not be importable by a team.
        await expectAssignTeamsDenied(adminClient, policyId, [team.id]);
    });
});
