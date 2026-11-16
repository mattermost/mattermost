// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for the ranked-value combobox on the System Console user detail page.
 *
 * A ranked Custom Profile Attribute renders the Compass attribute combobox: a typeable field
 * that lists values highest-rank-first, each with a numbered badge, marks the selected value,
 * filters as you type and can be cleared.
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
    return systemConsolePage.users.userDetail;
}

test.describe('System Console - Ranked value combobox', () => {
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
            await deleteCustomProfileAttributes(adminClient, {[field.id]: field});
            field = undefined;
        }
    });

    /**
     * @objective The ranked combobox lists values highest-rank-first with numbered badges and marks
     * the assigned value as selected; choosing a new value and saving persists it.
     *
     * @precondition
     * A ranked attribute (Unclassified/Secret/TopSecret) exists and the target
     * user is assigned "Secret".
     */
    test('renders ranked values highest-first and updates the assignment', {tag: '@user_management'}, async ({pw}) => {
        const label = field!.name;

        // # Log in as admin and open the target user's detail page
        const userDetail = await openUserDetail(pw, adminUser, testUser.id);
        const {userCard} = userDetail;
        const combobox = userCard.getCpaCombobox(label);
        await expect(combobox).toBeVisible({timeout: 30_000});

        // * The closed field shows the assigned value with its rank badge, and describes its rank
        await expect(combobox).toHaveValue('Secret');
        await expect(userCard.getCpaRankBadge(label)).toHaveText('2');
        await expect(combobox).toHaveAccessibleDescription('Rank 2');

        // # Open the combobox
        const listbox = await userCard.openCpaCombobox(label);
        const optionRow = (name: string) => listbox.getByRole('option', {name, exact: true});

        // * Values are listed highest-rank-first, each with its numbered badge and no colour swatch
        await expect(listbox.getByRole('option')).toHaveText([/^3\s*TopSecret$/, /^2\s*Secret$/, /^1\s*Unclassified$/]);
        await expect(listbox.getByTestId('rank-badge')).toHaveText(['3', '2', '1']);
        await expect(listbox.getByTestId('attribute-option-swatch')).toHaveCount(0);

        // * Each option is named with its rank, since the badge is hidden from assistive tech
        await expect(optionRow('TopSecret, Rank 3')).toBeVisible();
        await expect(optionRow('Unclassified, Rank 1')).toBeVisible();

        // * The assigned value is the selected option
        await expect(optionRow('Secret, Rank 2')).toHaveAttribute('aria-selected', 'true');

        // # Choose TopSecret
        await optionRow('TopSecret, Rank 3').click();

        // * The menu closes and the closed field shows the new value and badge, and describes the new rank
        await expect(combobox).toHaveAttribute('aria-expanded', 'false');
        await expect(combobox).toHaveValue('TopSecret');
        await expect(userCard.getCpaRankBadge(label)).toHaveText('3');
        await expect(combobox).toHaveAccessibleDescription('Rank 3');

        // # Save and confirm
        await userDetail.save();
        await expect(userDetail.saveChangesModal.changesList).toContainText(`${label}: Secret → TopSecret`);
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

    /**
     * @objective The ranked combobox filters its options as you type, Escape restores the assigned value, and clearing it saves an empty value.
     *
     * @precondition
     * A ranked attribute (Unclassified/Secret/TopSecret) exists and the target
     * user is assigned "Secret".
     */
    test('filters, clears and saves an empty rank value', {tag: '@user_management'}, async ({pw}) => {
        const label = field!.name;

        // # Log in as admin and open the target user's detail page
        const userDetail = await openUserDetail(pw, adminUser, testUser.id);
        const {userCard} = userDetail;
        const combobox = userCard.getCpaCombobox(label);
        await expect(combobox).toBeVisible({timeout: 30_000});

        // # Open the combobox and type part of an option name
        const listbox = await userCard.openCpaCombobox(label);
        await combobox.fill('Top');

        // * Only the matching option is listed
        await expect(listbox.getByRole('option')).toHaveText([/^3\s*TopSecret$/]);

        // # Close the menu with Escape
        await combobox.press('Escape');

        // * The menu closes and the input shows the assigned value again
        await expect(combobox).toHaveAttribute('aria-expanded', 'false');
        await expect(combobox).toHaveValue('Secret');

        // # Clear the value with the clear button
        const clearButton = userCard.getCpaComboboxClearButton(label);
        await clearButton.click();

        // * The input is empty with its placeholder, and the badge and clear button are gone
        await expect(combobox).toHaveValue('');
        await expect(combobox).toHaveAttribute('placeholder', 'Select an option');
        await expect(userCard.getCpaRankBadge(label)).toHaveCount(0);
        await expect(clearButton).not.toBeVisible();

        // # Save and confirm
        await userDetail.save();
        await expect(userDetail.saveChangesModal.changesList).toContainText(`${label}: Secret → (empty)`);
        await userDetail.saveChangesModal.confirm();
        await expect(userDetail.errorMessage).not.toBeVisible();
        await userDetail.waitForSaveComplete();

        // * The cleared value persisted
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(testUser.id);
                return values[field!.id] ?? '';
            })
            .toBe('');
    });
});
