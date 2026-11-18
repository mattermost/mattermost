// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App} from '@mattermost/playwright-lib';

import {
    type CpaFieldsMap,
    type CustomProfileAttribute,
    deleteCustomProfileAttributes,
    getFieldIdByName,
    openOwnPopover,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
} from './helpers';

function matchingOrder(actual: string[], expected: string[]) {
    return actual.filter((value) => expected.includes(value));
}

/** The created fields' ids, in the attributes' configured order. */
function orderedFieldIds(attributes: CustomProfileAttribute[], fields: CpaFieldsMap) {
    return attributes.map((attribute) => getFieldIdByName(fields, attribute.name));
}

/** Posts a message and opens the author's profile popover from its avatar. */
async function openOwnProfilePopover(app: App, message: string) {
    await openOwnPopover(app, message);
    return app.profilePopover;
}

/**
 * @objective Verify custom attributes preserve their configured order in profile settings and profile popovers.
 */
test(
    'MM-T5747 MM-T5751 keeps attribute order consistent in profile settings and the profile popover',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, team, user, userClient, townSquare} = await pw.initSetup();
        const suffix = pw.random.id();
        const labels = [`First ${suffix}`, `Second ${suffix}`, `Third ${suffix}`];
        const attributes: CustomProfileAttribute[] = labels.map((label, index) => ({
            name: `order_${index}_${suffix}`,
            type: 'text',
            value: `Value ${index + 1}`,
            attrs: {display_name: label, visibility: 'always'},
        }));
        // # Create ordered attributes and values
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);
        try {
            await setupCustomProfileAttributeValues(userClient, attributes, fields);
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: townSquare});
            const fieldIds = orderedFieldIds(attributes, fields);

            // * Verify the order in profile settings
            await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
            const settings = await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
            const sectionKeys = fieldIds;
            await expect
                .poll(async () => matchingOrder(await app.settings.customAttributeList.keys(), sectionKeys))
                .toEqual(sectionKeys);
            await settings.closeButton.click();
            await expect(settings).not.toBeVisible();

            // # Open the user's profile popover
            const popover = await openOwnProfilePopover(app, `Attribute order ${suffix}`);

            // * Verify the same order in the profile popover
            await expect
                .poll(async () => matchingOrder(await popover.attributeList.keys(), fieldIds))
                .toEqual(fieldIds);
        } finally {
            await deleteCustomProfileAttributes(adminClient, fields);
        }
    },
);

/**
 * @objective Verify a long profile popover scrolls while its bottom action row remains fixed.
 */
test(
    'MM-T5752 keeps the profile popover bottom row fixed while attributes scroll',
    {tag: '@custom_profile_attributes'},
    async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, team, user, userClient, townSquare} = await pw.initSetup();
        const suffix = pw.random.id();
        const attributes: CustomProfileAttribute[] = Array.from({length: 10}, (_, index) => ({
            name: `scroll_${index}_${suffix}`,
            type: 'text',
            value: `Value ${index + 1}`,
            attrs: {display_name: `Attribute ${index + 1} ${suffix}`, visibility: 'always'},
        }));
        const fields = await setupCustomProfileAttributeFields(adminClient, attributes);

        try {
            // # Open a profile popover containing ten populated attributes
            await setupCustomProfileAttributeValues(userClient, attributes, fields);
            const lastAttribute = attributes.at(-1);
            if (!lastAttribute) {
                throw new Error('Expected at least one attribute');
            }
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: townSquare});
            const popover = await openOwnProfilePopover(app, `Popover scroll ${suffix}`);
            await expect(popover.attribute({id: getFieldIdByName(fields, lastAttribute.name)})).toBeAttached();
            const container = popover.locator;
            const bottomRow = popover.actions.locator;

            // * Verify the popover is scrollable
            expect(
                await container.evaluate((element: HTMLElement) => element.scrollHeight > element.clientHeight),
            ).toBe(true);
            const bottomBefore = await bottomRow.boundingBox();
            if (!bottomBefore) {
                throw new Error('Expected the profile popover bottom row to have a bounding box');
            }

            // # Scroll to the bottom of the popover
            await container.evaluate((element: HTMLElement) => {
                element.scrollTop = element.scrollHeight;
            });
            await expect.poll(() => container.evaluate((element: HTMLElement) => element.scrollTop)).toBeGreaterThan(0);
            // * Verify the bottom action row remains visible and fixed
            await expect(bottomRow).toBeVisible();
            const bottomAfter = await bottomRow.boundingBox();
            if (!bottomAfter) {
                throw new Error('Expected the profile popover bottom row to remain visible after scrolling');
            }
            expect(Math.abs(bottomAfter.y - bottomBefore.y)).toBeLessThan(2);
        } finally {
            await deleteCustomProfileAttributes(adminClient, fields);
        }
    },
);
