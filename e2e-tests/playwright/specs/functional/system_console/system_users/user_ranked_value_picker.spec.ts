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

import {expect, getRandomId, test, duration} from '@mattermost/playwright-lib';

import {optionId} from '../../channels/channel_attributes/helpers';
import {deleteCustomProfileAttributes} from '../../channels/custom_profile_attributes/helpers';

test.describe('System Console - Ranked value combobox', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let testUser: UserProfile;
    let field: UserPropertyField | undefined;

    function createdField(): UserPropertyField {
        if (!field) {
            throw new Error('The ranked attribute was not created');
        }
        return field;
    }

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        if (!clientInfo.adminUser) {
            throw new Error('The admin user could not be read');
        }
        adminUser = clientInfo.adminUser;

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
        const rankField = createdField();
        const label = rankField.name;

        // # Log in as admin and open the target user's detail page
        const {app} = await pw.testBrowser.login(adminUser);
        await app.page.goto(`/admin_console/user_management/user/${testUser.id}`);
        const userDetail = app.admin.user;
        const attribute = userDetail.attribute(rankField);
        const combobox = attribute.valueChoiceCombobox.locator;
        await expect(combobox).toBeVisible({timeout: duration.half_min});

        // * The closed field shows the assigned value with its rank badge, and describes its rank
        await expect(combobox).toHaveValue('Secret');
        await expect(attribute.badgeText).toHaveText('2');
        await expect(combobox).toHaveAccessibleDescription('Rank 2');

        // # Open the combobox
        await combobox.click();
        await expect(combobox).toHaveAttribute('aria-expanded', 'true');
        const option = (name: string) => attribute.choice({id: optionId(rankField, name)});

        // * Values are listed highest-rank-first, each with its numbered badge and no colour swatch
        await expect(attribute.choiceList.locator).toHaveText([
            /^3\s*TopSecret$/,
            /^2\s*Secret$/,
            /^1\s*Unclassified$/,
        ]);
        expect(await attribute.choiceList.keys()).toEqual(
            ['TopSecret', 'Secret', 'Unclassified'].map((name) => optionId(rankField, name)),
        );
        await expect(option('TopSecret').badgeText).toHaveText('3');
        await expect(option('Secret').badgeText).toHaveText('2');
        await expect(option('Unclassified').badgeText).toHaveText('1');
        await expect(option('TopSecret').swatch).toHaveCount(0);

        // * Each option is named with its rank, since the badge is hidden from assistive tech
        await expect(option('TopSecret')).toHaveAccessibleName('TopSecret, Rank 3');
        await expect(option('Unclassified')).toHaveAccessibleName('Unclassified, Rank 1');

        // * The assigned value is the selected option
        await expect(option('Secret')).toHaveAttribute('aria-selected', 'true');

        // # Choose TopSecret
        await option('TopSecret').container.click();

        // * The menu closes and the closed field shows the new value and badge, and describes the new rank
        await expect(combobox).toHaveAttribute('aria-expanded', 'false');
        await expect(combobox).toHaveValue('TopSecret');
        await expect(attribute.badgeText).toHaveText('3');
        await expect(combobox).toHaveAccessibleDescription('Rank 3');

        // # Save and confirm
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await expect(userDetail.saveModal.changesList.locator).toContainText(`${label}: Secret → TopSecret`);
        await confirm.confirmButton.click();
        await expect(confirm.confirmButton).not.toBeVisible();
        await expect(userDetail.saveErrorText).not.toBeVisible();

        // * The new assignment persisted (the TopSecret option id)
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(testUser.id);
                return values[rankField.id];
            })
            .toBe(optionId(rankField, 'TopSecret'));
    });

    /**
     * @objective The ranked combobox filters its options as you type, Escape restores the assigned value, and clearing it saves an empty value.
     *
     * @precondition
     * A ranked attribute (Unclassified/Secret/TopSecret) exists and the target
     * user is assigned "Secret".
     */
    test('filters, clears and saves an empty rank value', {tag: '@user_management'}, async ({pw}) => {
        const rankField = createdField();
        const label = rankField.name;

        // # Log in as admin and open the target user's detail page
        const {app} = await pw.testBrowser.login(adminUser);
        await app.page.goto(`/admin_console/user_management/user/${testUser.id}`);
        const userDetail = app.admin.user;
        const attribute = userDetail.attribute(rankField);
        const combobox = attribute.valueChoiceCombobox.locator;
        await expect(combobox).toBeVisible({timeout: duration.half_min});

        // # Open the combobox and type part of an option name
        await combobox.click();
        await expect(combobox).toHaveAttribute('aria-expanded', 'true');
        await combobox.fill('Top');

        // * Only the matching option is listed
        await expect(attribute.choiceList.locator).toHaveText([/^3\s*TopSecret$/]);

        // # Close the menu with Escape
        await combobox.press('Escape');

        // * The menu closes and the input shows the assigned value again
        await expect(combobox).toHaveAttribute('aria-expanded', 'false');
        await expect(combobox).toHaveValue('Secret');

        // # Clear the value with the clear button
        await attribute.clearButton.click();

        // * The input is empty with its placeholder, and the badge and clear button are gone
        await expect(combobox).toHaveValue('');
        await expect(combobox).toHaveAttribute('placeholder', 'Select an option');
        await expect(attribute.badgeText).toHaveCount(0);
        await expect(attribute.clearButton).not.toBeVisible();

        // # Save and confirm
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await expect(userDetail.saveModal.changesList.locator).toContainText(`${label}: Secret → (empty)`);
        await confirm.confirmButton.click();
        await expect(confirm.confirmButton).not.toBeVisible();
        await expect(userDetail.saveErrorText).not.toBeVisible();

        // * The cleared value persisted
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(testUser.id);
                return values[rankField.id] ?? '';
            })
            .toBe('');
    });
});
