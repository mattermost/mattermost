// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify saving File Storage with another driver selected keeps the saved
 * Azure Blob Storage SSL setting, so switching back to Azure loads it unchanged.
 */
test('MM-69542 keeps Azure SSL enabled when File Storage is saved with another driver', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Start on local storage with Azure SSL enabled
    await adminClient.patchConfig({
        FileSettings: {DriverName: 'local', AzureSSL: true},
    } as Partial<AdminConfig>);

    // # Open the File Storage page
    const {page} = await pw.testBrowser.login(adminUser);
    await page.goto('/admin_console/environment/file_storage');

    const section = page.getByTestId('sysconsole_section_FileSettings');
    await expect(section).toBeVisible();
    const driverDropdown = section.getByTestId('FileSettings.DriverNamedropdown');
    const azureSSLTrue = section.getByTestId('FileSettings.AzureSSLtrue');
    const saveButton = section.getByRole('button', {name: 'Save'});

    // # Switch to Azure Blob Storage and back to Local File System, then save
    await driverDropdown.selectOption('azureblob');
    await expect(azureSSLTrue).toBeChecked();
    await driverDropdown.selectOption('local');
    const saveResponse = page.waitForResponse(
        (resp) => resp.url().endsWith('/api/v4/config/patch') && resp.request().method() === 'PUT',
    );
    await saveButton.click();
    const response = await saveResponse;
    await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

    // * The save succeeded and kept Azure SSL enabled
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON().FileSettings.AzureSSL).toBe(true);
    const savedConfig = await adminClient.getConfig();
    expect(savedConfig.FileSettings.DriverName).toBe('local');
    expect(savedConfig.FileSettings.AzureSSL).toBe(true);

    // # Reload and switch back to Azure Blob Storage
    await page.reload();
    await expect(section).toBeVisible();
    await driverDropdown.selectOption('azureblob');

    // * Azure SSL loads as enabled
    await expect(azureSSLTrue).toBeChecked();
});
