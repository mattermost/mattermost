// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes Duplicate (`?from=` unsaved-create prefill).
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {
    ATTRIBUTE_DETAILS_PATH,
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    createLinkedDependentField,
    deleteAppliesToAttributeAndLinkedFieldsIfExists,
    deleteGlobalAttributeFieldIfExists,
    fetchLinkedFieldsForTemplate,
    getGlobalAttributeFieldByName,
    requireGlobalAttributesEnabled,
} from './global_attributes_helpers';

// Same flag set as the create/edit form suite: Channel/Post for Applies-to
// coverage, PropertyFieldGraph kept on so the suite stays aligned with that file.
const FEATURE_FLAGS = {ChannelAttributes: true, PostAttributes: true, PropertyFieldGraph: true} as const;

test.describe('System Console - Global Attributes duplicate', {tag: '@system_console'}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Ensure Duplicate from the listing opens create with `?from=`, prefills
     * Definition and Applies-to without sync links, leaves the listing unchanged until Save,
     * then creates a new template (and linked Users field) on Save.
     */
    test('duplicates via listing into an unsaved create page, then Save creates the copy', async ({pw}) => {
        await pw.ensureFeatureFlag(FEATURE_FLAGS);
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const timestamp = Date.now();
        // Short prefixes: display name max is 40, and Duplicate prefixes "Copy of ".
        const sourceName = `e2e_dup_${timestamp}`;
        const sourceDisplayName = `PW Dup ${timestamp}`;
        const copyDisplayName = `Copy of ${sourceDisplayName}`;
        const renamedDisplayName = `PW Dup New ${timestamp}`;
        const renamedName = `pw_dup_new_${timestamp}`;

        try {
            const template = await createGlobalAttributeField(adminClient, sourceName, {
                type: 'select',
                attrs: {
                    display_name: sourceDisplayName,
                    options: [
                        {id: '', name: 'Engineering'},
                        {id: '', name: 'Sales'},
                    ],
                    ldap: 'department',
                },
            });
            await createLinkedDependentField(adminClient, sourceName, template.id, 'select', 'user', {
                display_name: sourceDisplayName,
                visibility: 'always',
                managed: 'admin',
                options: [
                    {id: '', name: 'Engineering'},
                    {id: '', name: 'Sales'},
                ],
            });

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            const ga = systemConsolePage.globalAttributes;

            // # Open Attribute Management and Duplicate the seeded template
            await ga.gotoListing();
            await ga.search(sourceDisplayName);
            await expect(ga.rowByLabel(sourceDisplayName)).toBeVisible();
            await ga.duplicateFromListing(template.id);

            // * Create URL carries ?from=<source id>; form is a New-attribute draft
            await expect(page).toHaveURL(new RegExp(`attribute_details\\?from=${template.id}`));
            await expect(page.getByRole('heading', {name: 'New attribute'})).toBeVisible();
            await expect(ga.displayNameInput).toHaveValue(copyDisplayName);
            await expect(ga.displayNameInput).toBeFocused();
            await expect(ga.typeMenuButton).toContainText('Select');
            await expect(ga.optionChips).toHaveCount(2);
            await expect(ga.optionChips.filter({hasText: 'Engineering'})).toBeVisible();
            await expect(ga.optionChips.filter({hasText: 'Sales'})).toBeVisible();
            await expect(ga.appliesToUserRow).toBeVisible();
            await expect(page.getByTestId('attributeExternalSourceChip-ldap')).toHaveCount(0);

            // * Prefills Users row config from the source linked field
            await page.getByTestId('attributeAppliesToRow-user-toggle').click();
            await expect(page.getByTestId('attributeAppliesToUserProfileDisplay-always')).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            await expect(page.getByTestId('attributeAppliesToUserWhoCanSet-admin')).toBeChecked();

            // * Nothing persisted yet — only the source template exists under its name,
            // and no renamed copy exists (listing would be dirty if we navigated away)
            expect(await getGlobalAttributeFieldByName(adminClient, sourceName)).toBeDefined();
            expect(await getGlobalAttributeFieldByName(adminClient, renamedName)).toBeUndefined();
            const sourceLinkedBefore = await fetchLinkedFieldsForTemplate(adminClient, template.id);
            expect(sourceLinkedBefore.filter((field) => field.object_type === 'user')).toHaveLength(1);

            // # Rename so the copy gets a known unique name, then Save
            await ga.setDisplayName(renamedDisplayName);
            await expect(page.getByTestId('attributeUniqueNameValue')).toHaveText(renamedName);
            await ga.save();

            // * New template exists with Select options; source unchanged (still has ldap)
            const copy = await getGlobalAttributeFieldByName(adminClient, renamedName);
            expect(copy).toBeDefined();
            expect(copy!.type).toBe('select');
            expect(copy!.attrs?.display_name).toBe(renamedDisplayName);
            expect(copy!.attrs?.ldap).toBeUndefined();
            const copyOptions = copy!.attrs?.options as Array<{name: string}> | undefined;
            expect(copyOptions?.map((option) => option.name)).toEqual(['Engineering', 'Sales']);

            const sourceAfter = await getGlobalAttributeFieldByName(adminClient, sourceName);
            expect(sourceAfter?.attrs?.ldap).toBe('department');
            expect(sourceAfter?.attrs?.display_name).toBe(sourceDisplayName);

            const copyLinked = await fetchLinkedFieldsForTemplate(adminClient, copy!.id);
            const copyUser = copyLinked.find((field) => field.object_type === 'user');
            expect(copyUser).toBeDefined();
            expect(copyUser!.attrs?.visibility).toBe('always');
            expect(copyUser!.attrs?.managed).toBe('admin');

            // * Listing shows both the source and the new copy
            await ga.search(String(timestamp));
            await expect(ga.rowByLabel(sourceDisplayName)).toBeVisible();
            await expect(ga.rowByLabel(renamedDisplayName)).toBeVisible();
        } finally {
            await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, renamedName);
            await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, sourceName);
        }
    });

    /**
     * @objective Ensure deep-linking create with an unknown or non-duplicable `from` id
     * redirects back to the Attribute Management listing instead of leaving a broken draft.
     */
    test('redirects to the listing when ?from= is missing or not a duplicable template', async ({pw}) => {
        await pw.ensureFeatureFlag(FEATURE_FLAGS);
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

        const timestamp = Date.now();
        const sourceName = `e2e_dup_bad_${timestamp}`;
        const sourceDisplayName = `PW Dup Bad ${timestamp}`;

        try {
            const template = await createGlobalAttributeField(adminClient, sourceName, {
                type: 'text',
                attrs: {display_name: sourceDisplayName},
            });
            const linkedUser = await createLinkedDependentField(adminClient, sourceName, template.id, 'text', 'user', {
                display_name: sourceDisplayName,
            });

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            const ga = systemConsolePage.globalAttributes;

            // # Unknown source id
            await page.goto(`${ATTRIBUTE_DETAILS_PATH}?from=notarealfieldid000000000000`);
            await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
            await expect(page.getByTestId('global-attributes-search')).toBeVisible();

            // # Non-template (linked Users field) id is not duplicable
            await page.goto(`${ATTRIBUTE_DETAILS_PATH}?from=${linkedUser.id}`);
            await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
            await expect(ga.displayNameInput).toHaveCount(0);
        } finally {
            await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, sourceName);
            await deleteGlobalAttributeFieldIfExists(adminClient, sourceName);
        }
    });
});
