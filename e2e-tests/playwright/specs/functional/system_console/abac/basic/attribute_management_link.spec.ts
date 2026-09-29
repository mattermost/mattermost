// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Attribute-Based Access → Attribute Management help-link destination.
 * The enable toggle's help text must point at manage_attributes (Attribute Management),
 * not the legacy user_attributes URL that only redirects.
 */

import {expect, test, licenseTier} from '@mattermost/playwright-lib';

import {GLOBAL_ATTRIBUTES_ADMIN_PATH} from '../../global_attributes/global_attributes_helpers';

test(
    'ABAC enable help link goes to Attribute Management, not the legacy User Attributes redirect',
    {tag: '@system_console'},
    async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            licenseTier(license.SkuShortName) < 30,
            'Attribute-Based Access requires Enterprise Advanced (SkuShortName advanced/entry).',
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;

        // # Open the Attribute-Based Access settings page (where the enable toggle lives)
        await page.goto('/admin_console/system_attributes/attribute_based_access_control');
        await expect(page.getByTestId('sysconsole_section_AttributeBasedAccessControl')).toBeVisible();

        // * Help text names Attribute Management and points at manage_attributes
        // (scoped to the setting's help-text — the sidebar also links Attribute Management)
        const helpLink = page.
            getByTestId('AccessControlSettings.EnableAttributeBasedAccessControlhelp-text').
            getByRole('link', {name: 'Attribute Management', exact: true});
        await expect(helpLink).toBeVisible();
        await expect(helpLink).toHaveAttribute('href', '../system_attributes/manage_attributes');

        // # Follow the help link
        await helpLink.click();

        // * Lands on Attribute Management (not the redirect-only user_attributes path)
        await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
        await expect(page.getByTestId('admin-console-header').getByText('Attribute Management')).toBeVisible();
        await expect(page.getByTestId('newAttributeButton')).toBeVisible();
    },
);
