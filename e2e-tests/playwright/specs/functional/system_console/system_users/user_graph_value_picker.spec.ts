// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for the hierarchical (graph) value picker on the System Console
 * user detail page.
 *
 * A hierarchical Custom Profile Attribute renders its assigned values as chips
 * inside the picker trigger, each with an "x" control that removes the value.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import type {CpaFieldsMap} from '../../channels/custom_profile_attributes/helpers';
import {deleteCustomProfileAttributes} from '../../channels/custom_profile_attributes/helpers';

function optionId(field: UserPropertyField, name: string): string {
    const option = (field.attrs.options ?? []).find((o: PropertyFieldOption) => o.name === name);
    if (!option) {
        throw new Error(`Option "${name}" not found on field ${field.name}`);
    }
    return option.id;
}

test.describe('System Console - Hierarchical value picker', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let testUser: UserProfile;
    let field: UserPropertyField | undefined;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('PropertyFieldGraph', true);

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser!;

        // # Create a hierarchical attribute: Fruits > {Yellow, Red, Green} Fruits
        field = await adminClient.createCustomProfileAttributeField({
            name: `basket_${getRandomId()}`,
            type: 'graph',
            attrs: {
                sort_order: 0,
                visibility: 'always',
                value_type: '',
                options: [
                    {id: '', name: 'Fruits', parents: []},
                    {id: '', name: 'Yellow Fruits', parents: ['Fruits']},
                    {id: '', name: 'Red Fruits', parents: ['Fruits']},
                    {id: '', name: 'Green Fruits', parents: ['Fruits']},
                ],
            },
        });

        // # Create a target user holding three of those values
        testUser = await pw.createNewUserProfile(adminClient, {prefix: 'graph-picker-target-'});
        await adminClient.updateUserCustomProfileAttributesValues(testUser.id, {
            [field.id]: [
                optionId(field, 'Yellow Fruits'),
                optionId(field, 'Red Fruits'),
                optionId(field, 'Green Fruits'),
            ],
        });
    });

    test.afterEach(async () => {
        if (field) {
            await deleteCustomProfileAttributes(adminClient, {
                [field.id]: field,
                ownedIds: new Set([field.id]),
            } as CpaFieldsMap);
            field = undefined;
        }
    });

    /**
     * Opens the target user's System Console detail page as the admin.
     */
    async function gotoUserDetail(pw: PlaywrightExtended) {
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.page.goto(`/admin_console/user_management/user/${testUser.id}`);
        await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);

        return systemConsolePage;
    }

    /**
     * @objective The chip's "x" control covers the chip from top to bottom, so
     * hovering and clicking it at either edge removes that value instead of
     * falling through to the picker trigger underneath.
     *
     * @precondition
     * A hierarchical attribute exists and the target user holds "Yellow Fruits",
     * "Red Fruits" and "Green Fruits".
     */
    test('removes a value when its chip x is used at the chip edges', {tag: '@user_management'}, async ({pw}) => {
        const fieldId = field!.id;

        // # Log in as admin and open the target user's detail page
        const systemConsolePage = await gotoUserDetail(pw);
        const {page} = systemConsolePage;
        const {userCard} = systemConsolePage.users.userDetail;

        const yellowChip = userCard.getCpaGraphChip(fieldId, 'Yellow Fruits');
        await expect(yellowChip).toBeVisible({timeout: 30_000});
        await expect(userCard.cpaGraphChips(fieldId)).toHaveCount(3);

        // # Open the picker from its trigger, then close it again
        await userCard.openCpaGraphPicker(fieldId);

        // * The menu lists the hierarchy's root, with the children collapsed under it
        const menu = userCard.cpaGraphMenu(fieldId);
        await expect(menu.getByRole('menuitemcheckbox', {name: 'Fruits', exact: true})).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);

        // # Point at the remove control one pixel below the chip's top edge
        const yellowRemove = userCard.getCpaGraphChipRemove(fieldId, 'Yellow Fruits');
        await page.mouse.move(0, 0);
        const restingBackground = await yellowRemove.evaluate(
            (element: HTMLElement) => getComputedStyle(element).backgroundColor,
        );
        const yellowBox = (await yellowChip.boundingBox())!;
        const yellowRemoveBox = (await yellowRemove.boundingBox())!;
        const yellowX = yellowRemoveBox.x + yellowRemoveBox.width / 2;
        await page.mouse.move(yellowX, yellowBox.y + 1);

        // * It paints its hover state that far up
        await expect
            .poll(() => yellowRemove.evaluate((element: HTMLElement) => getComputedStyle(element).backgroundColor))
            .not.toBe(restingBackground);

        // # Click at that same point
        await page.mouse.click(yellowX, yellowBox.y + 1);

        // * That value is dropped and the picker menu stays closed
        await expect(yellowChip).toHaveCount(0);
        await expect(userCard.cpaGraphChips(fieldId)).toHaveCount(2);
        await expect(menu).toHaveCount(0);

        // # Click another chip's remove control one pixel above its bottom edge
        const redChip = userCard.getCpaGraphChip(fieldId, 'Red Fruits');
        const redBox = (await redChip.boundingBox())!;
        const redRemoveBox = (await userCard.getCpaGraphChipRemove(fieldId, 'Red Fruits').boundingBox())!;
        await page.mouse.click(redRemoveBox.x + redRemoveBox.width / 2, redBox.y + redBox.height - 1);

        // * That value is dropped too, leaving only the untouched one
        await expect(redChip).toHaveCount(0);
        await expect(userCard.cpaGraphChips(fieldId)).toHaveCount(1);
        await expect(userCard.getCpaGraphChip(fieldId, 'Green Fruits')).toBeVisible();
        await expect(menu).toHaveCount(0);
    });

    /**
     * @objective Removing a hierarchical value through its chip and saving
     * persists the remaining values for that user.
     *
     * @precondition
     * A hierarchical attribute exists and the target user holds "Yellow Fruits",
     * "Red Fruits" and "Green Fruits".
     */
    test('persists a removed value after save', {tag: '@user_management'}, async ({pw}) => {
        const fieldId = field!.id;

        // # Log in as admin and open the target user's detail page
        const systemConsolePage = await gotoUserDetail(pw);
        const {userDetail} = systemConsolePage.users;
        const {userCard} = userDetail;
        await expect(userCard.cpaGraphChips(fieldId)).toHaveCount(3, {timeout: 30_000});

        // # Remove one value and save
        await userCard.getCpaGraphChipRemove(fieldId, 'Yellow Fruits').click();
        await expect(userCard.cpaGraphChips(fieldId)).toHaveCount(2);
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();
        await expect(userDetail.errorMessage).not.toBeVisible();
        await userDetail.waitForSaveComplete();

        // # Reload the user detail page
        await systemConsolePage.page.goto(`/admin_console/user_management/user/${testUser.id}`);
        await systemConsolePage.page.waitForURL(`**/admin_console/user_management/user/${testUser.id}`);

        // * The remaining chips are still shown and the removed value stays gone
        await expect(userCard.getCpaGraphChip(fieldId, 'Red Fruits')).toBeVisible({timeout: 30_000});
        await expect(userCard.getCpaGraphChip(fieldId, 'Green Fruits')).toBeVisible();
        await expect(userCard.getCpaGraphChip(fieldId, 'Yellow Fruits')).toHaveCount(0);

        // * Only the remaining values persisted
        await expect
            .poll(async () => {
                const values = await adminClient.getUserCustomProfileAttributesValues(testUser.id);
                return values[fieldId];
            })
            .toEqual([optionId(field!, 'Red Fruits'), optionId(field!, 'Green Fruits')]);
    });
});
