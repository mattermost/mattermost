// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {type PlaywrightExtended, type SystemConsolePage, test} from '@mattermost/playwright-lib';

/**
 * Skip test when the server does not have the Enterprise Advanced license
 * (accepting either `SkuShortName` or `short_sku_name` equal to "advanced").
 * Shared by the self_deleting_messages_* specs.
 */
export function skipIfNotAdvancedLicense(license: {SkuShortName?: string; short_sku_name?: string}) {
    test.skip(
        license.SkuShortName !== 'advanced' && license.short_sku_name !== 'advanced',
        'Skipping test - server does not have enterprise advanced license',
    );
}

/**
 * Wait for the Mobile Security save button to settle back to the default "Save" label.
 * Shared by the mobile_security_* specs that persist configuration.
 */
export async function waitForMobileSecuritySaveSettled(
    pw: PlaywrightExtended,
    systemConsolePage: SystemConsolePage,
): Promise<void> {
    await pw.waitUntil(async () => (await systemConsolePage.mobileSecurity.saveButton.textContent()) === 'Save');
}

/**
 * Navigate away to Users and come back to Mobile Security to verify persistence.
 * Shared by the mobile_security_* specs that round-trip the section.
 */
export async function reloadMobileSecurityViaUsers(systemConsolePage: SystemConsolePage): Promise<void> {
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();

    await systemConsolePage.sidebar.mobileSecurity.click();
    await systemConsolePage.mobileSecurity.toBeVisible();
}

/**
 * Navigate to the System Console > Site Configuration > Posts section.
 * Shared by the self_deleting_messages_* specs that operate on Burn-on-Read settings.
 */
export async function gotoPostSettings(systemConsolePage: SystemConsolePage, page: Page): Promise<void> {
    await systemConsolePage.sidebar.siteConfiguration.posts.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Return locators for the Burn-on-Read settings controls in the Posts section.
 * Shared by the self_deleting_messages_* specs.
 */
export function getBurnOnReadSettings(page: Page) {
    const postsSection = page.getByTestId('sysconsole_section_PostSettings');
    return {
        postsSection,
        enableToggleTrue: postsSection.getByTestId('ServiceSettings.EnableBurnOnReadtrue'),
        enableToggleFalse: postsSection.getByTestId('ServiceSettings.EnableBurnOnReadfalse'),
        durationDropdown: postsSection.getByTestId('ServiceSettings.BurnOnReadDurationSecondsdropdown'),
        maxTTLDropdown: postsSection.getByTestId('ServiceSettings.BurnOnReadMaximumTimeToLiveSecondsdropdown'),
        saveButton: postsSection.getByRole('button', {name: 'Save'}),
    };
}
