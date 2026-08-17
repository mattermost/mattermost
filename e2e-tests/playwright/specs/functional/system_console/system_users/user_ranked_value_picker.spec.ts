// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for the ranked-value picker on the System Console user detail page.
 *
 * A ranked Custom Profile Attribute renders a menu picker that lists values
 * highest-rank-first, each with a numbered badge, and a checkmark on the
 * currently selected value.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../channels/custom_profile_attributes/helpers';

function optionId(field: UserPropertyField, name: string): string {
    const option = (field.attrs.options ?? []).find((o: PropertyFieldOption) => o.name === name);
    if (!option) {
        throw new Error(`Option "${name}" not found on field ${field.name}`);
    }
    return option.id;
}

test.describe('System Console - Ranked value picker', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let testUser: UserProfile;
    let field: UserPropertyField | undefined;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser!;

        // # Create a ranked attribute (highest rank = most privileged)
        field = await adminClient.createCustomProfileAttributeField({
            name: `clearance_${getRandomId()}`,
            type: 'rank',
            attrs: {
                sort_order: 0,
                visibility: 'always',
                options: [
                    {name: 'Unclassified', rank: 1},
                    {name: 'Secret', rank: 2},
                    {name: 'TopSecret', rank: 3},
                ],
            },
        } as any);

        // # Create a target user and pre-assign the "Secret" value
        testUser = await pw.createNewUserProfile(adminClient, {prefix: 'rank-picker-target-'});
        await adminClient.updateUserCustomProfileAttributesValues(testUser.id, {
            [field.id]: optionId(field, 'Secret'),
        });
    });

    test.afterEach(async () => {
        if (field) {
            await deleteCustomProfileAttributes(adminClient, {
                [field.id]: field,
                __ownedIds: new Set([field.id]),
            } as any);
            field = undefined;
        }
    });

    /**
     * @objective The ranked picker lists values highest-rank-first with numbered
     * badges and a checkmark on the assigned value; choosing a new value and
     * saving persists it.
     *
     * @precondition
     * A ranked attribute (Unclassified/Secret/TopSecret) exists and the target
     * user is assigned "Secret".
     */
    test('renders ranked values highest-first and updates the assignment', async ({pw}) => {
        const label = field!.name;

        // # Log in as admin and open the target user's detail page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto(`/admin_console/user_management/user/${testUser.id}`);
        await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);

        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;
        await expect(userCard.getCpaRankPicker(label)).toBeVisible({timeout: 30_000});

        // * The closed picker shows the assigned value
        await expect(userCard.getCpaRankPicker(label)).toContainText('Secret');

        // # Open the picker
        await userCard.openCpaRankPicker(label);

        // * Values are listed highest-rank-first, each with its numbered badge
        const items = userCard.cpaRankMenuItems();
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toContainText('TopSecret');
        await expect(items.nth(0)).toContainText('3');
        await expect(items.nth(1)).toContainText('Secret');
        await expect(items.nth(2)).toContainText('Unclassified');
        await expect(items.nth(2)).toContainText('1');

        // * The assigned value (Secret) carries the selected/checked state
        const secretItem = items.filter({has: systemConsolePage.page.getByText('Secret', {exact: true})});
        await expect(secretItem).toHaveAttribute('aria-checked', 'true');

        // # Choose TopSecret
        await userCard.cpaRankMenu().getByText('TopSecret', {exact: true}).click();

        // * The closed picker reflects the new value
        await expect(userCard.getCpaRankPicker(label)).toContainText('TopSecret');

        // # Save and confirm
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();
        await expect(userDetail.errorMessage).not.toBeVisible();
        await userDetail.waitForSaveComplete();

        // * The new assignment persisted (the TopSecret option id)
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(testUser.id);
                return values[field!.id];
            })
            .toBe(optionId(field!, 'TopSecret'));
    });
});
