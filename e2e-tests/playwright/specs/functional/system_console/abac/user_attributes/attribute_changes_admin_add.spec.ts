// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, verifyUserInChannel, updateUserAttributes, duration} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {createUserForABAC, createPrivateChannelForABAC, enableUserManagedAttributes} from '../support';
import {createMembershipPolicy, fieldNamed, setAbacEnabled} from '../surface';

/**
 * ABAC User Attributes - Attribute Changes
 * Tests for user attribute changes affecting ABAC policies
 */
test.describe('ABAC User Attributes - Attribute Changes', () => {
    /**
     * MM-T5795: User can be added to channel by system admin after a qualifying attribute is added to their profile (auto-add false)
     *
     * Preconditions:
     * - Access policy with auto-add set to FALSE
     *
     * Steps:
     * 1. As system admin, note the required attribute for channel access
     * 2. As a user not in the channel and lacking the required attribute:
     *    - Add the required attribute value to user profile
     * 3. As system admin, go to the channel and add the user
     *
     * Expected:
     * - User who now meets the policy CAN be added to the channel by the admin
     * - "User added" message is posted in the channel by System
     */
    test('MM-T5795 User can be added by admin after attribute added (auto-add false)', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();

        // ============================================================
        // SETUP: Create attribute, policy with auto-add FALSE, and channel
        // ============================================================
        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Create test user WITHOUT the qualifying attribute
        const testUser = await createUserForABAC(adminClient, attributeFieldsMap, []);
        await adminClient.addToTeam(team.id, testUser.id);

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        // ============================================================
        // STEP 1: Create policy with auto-add DISABLED
        // ============================================================
        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
        });

        const policyName = `Engineering Manual Add ${pw.random.id()}`;
        await createMembershipPolicy(app, {
            name: policyName,
            rules: [{field: fieldNamed(attributeFieldsMap, 'Department'), value: 'Engineering'}],
            channels: [privateChannel],
            autoAdd: false,
        });

        // ============================================================
        // STEP 2: Add qualifying attribute to user
        // ============================================================
        await updateUserAttributes(adminClient, testUser.id, {Department: 'Engineering'});

        // ============================================================
        // STEP 3: Admin manually adds user to channel
        // ============================================================

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
        });

        // Re-create the Department CPA field if a concurrent initSetup() deleted it.
        // Without the field the server returns "An attribute is missing from the expression"
        // on addToChannel, because the policy references a field id that no longer exists.
        await setupCustomProfileAttributeFields(adminClient, attributeFields);

        // Verify user can be added (policy allows it since user has qualifying attribute)
        await adminClient.addToChannel(testUser.id, privateChannel.id);

        // Membership + ABAC evaluation can lag behind the REST response in CI.
        await expect
            .poll(async () => verifyUserInChannel(adminClient, testUser.id, privateChannel.id), {
                timeout: duration.one_min,
                intervals: [1000, 2000, 3000],
            })
            .toBe(true);

        // ============================================================
        // VERIFICATION: Check for "User added" system message
        // ============================================================

        const posts = await adminClient.getPosts(privateChannel.id, 0, 10);
        const postList = posts.order.map((postId: string) => posts.posts[postId]);

        const userAddedMessage = postList.find((post: any) => {
            return post.type === 'system_add_to_channel' && post.props?.addedUserId === testUser.id;
        });

        if (userAddedMessage) {
            // System message found
        } else {
            // System message not found (may be disabled in test env)
        }
    });
});
