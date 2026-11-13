// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for the graph value picker on the System Console user detail page.
 *
 * A graph Custom Profile Attribute renders a chip field that opens a menu of its hierarchical
 * values. These tests cover the closed field: its chips, removing a chip, and opening and
 * closing the menu.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {optionId} from '../../channels/channel_attributes/helpers';
import {deleteCustomProfileAttributes} from '../../channels/custom_profile_attributes/helpers';

async function openUserDetail(pw: PlaywrightExtended, admin: UserProfile, userId: string) {
    const {systemConsolePage} = await pw.testBrowser.login(admin);
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.page.goto(`/admin_console/user_management/user/${userId}`);
    await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${userId}`);
    return systemConsolePage;
}

test.describe('System Console - Graph value picker', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let testUser: UserProfile;
    let field: UserPropertyField | undefined;

    async function setUp(pw: PlaywrightExtended) {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('PropertyFieldGraph', true);

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser!;

        // # Create a graph attribute with two top-level values
        field = await adminClient.createCustomProfileAttributeField({
            name: `programs_${getRandomId()}`,
            type: 'graph',
            attrs: {
                sort_order: 0,
                visibility: 'always',
                options: [{name: 'Alpha'}, {name: 'Beta'}],
            },
        } as any);

        // # Create a target user and assign both values
        testUser = await pw.createNewUserProfile(adminClient, {prefix: 'graph-picker-target-'});
        await adminClient.updateUserCustomProfileAttributesValues(testUser.id, {
            [field.id]: [optionId(field, 'Alpha'), optionId(field, 'Beta')],
        });
    }

    test.afterEach(async () => {
        if (field) {
            await deleteCustomProfileAttributes(adminClient, {[field.id]: field});
            field = undefined;
        }
    });

    /**
     * @objective The graph picker shows one chip per assigned value. Removing a chip leaves the menu
     * closed, clicking the field opens the menu with the remaining value checked, Escape closes it
     * and returns focus to the field, and saving persists the removal.
     *
     * @precondition
     * A graph attribute with two top-level values (Alpha, Beta) exists and the target user holds both.
     */
    test('removes a chip without opening the menu and saves the rest', {tag: '@user_management'}, async ({pw}) => {
        await setUp(pw);
        const label = field!.name;

        // # Log in as admin and open the target user's detail page
        const systemConsolePage = await openUserDetail(pw, adminUser, testUser.id);
        const {page} = systemConsolePage;
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;
        const chips = userCard.getCpaChips(label);
        const trigger = page.getByTestId(`cpa-graph-select-${field!.id}`);
        const menu = page.locator(`#cpa-graph-menu-${field!.id}`);
        const row = (name: string) => menu.getByRole('menuitemcheckbox', {name, exact: true});

        // * The closed field shows both assigned values as chips and no menu
        await expect(chips).toHaveText(['Alpha', 'Beta'], {timeout: 30_000});
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // # Remove the Alpha chip
        await userCard.removeCpaChip(label, 'Alpha');

        // * Only Beta remains and the menu stays closed
        await expect(chips).toHaveText(['Beta']);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(menu).not.toBeVisible();

        // # Open the menu by clicking the field
        await trigger.click();

        // * The menu opens with Beta checked and Alpha unchecked
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(row('Alpha')).toHaveAttribute('aria-checked', 'false');
        await expect(row('Beta')).toHaveAttribute('aria-checked', 'true');

        // # Close the menu with Escape
        await page.keyboard.press('Escape');

        // * The menu closes, focus returns to the field and the chips are unchanged
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(menu).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await expect(chips).toHaveText(['Beta']);

        // # Save and confirm
        await userDetail.save();
        await expect(userDetail.saveChangesModal.changesList).toContainText(`${label}: Alpha and Beta → Beta`);
        await userDetail.saveChangesModal.confirm();
        await expect(userDetail.errorMessage).not.toBeVisible();
        await userDetail.waitForSaveComplete();

        // * Only Beta persisted
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(testUser.id);
                return values[field!.id];
            })
            .toEqual([optionId(field!, 'Beta')]);
    });
});
