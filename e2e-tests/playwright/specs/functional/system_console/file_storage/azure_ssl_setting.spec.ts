// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

const MEBIBYTE = 1024 * 1024;

/**
 * @objective Verify saving File Storage while another driver is selected keeps the saved
 * Azure Blob Storage SSL setting instead of resetting it to false.
 */
test(
    'MM-69542 keeps Azure SSL enabled when File Storage is saved with another driver',
    {tag: '@system_console'},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Enable Azure SSL while the server stores files on local disk
        const originalMaxFileSize = (await adminClient.getConfig()).FileSettings.MaxFileSize;
        await adminClient.patchConfig({
            FileSettings: {AzureSSL: true},
        } as Partial<AdminConfig>);

        // # Open the File Storage page
        const {page} = await pw.testBrowser.login(adminUser);
        await page.goto('/admin_console/environment/file_storage');

        const section = page.getByTestId('sysconsole_section_FileSettings');
        await expect(section).toBeVisible();
        await expect(section.getByTestId('FileSettings.DriverNamedropdown')).toHaveValue('local');

        // # Change another setting and save
        await section.getByTestId('FileSettings.MaxFileSizenumber').fill(String(originalMaxFileSize / MEBIBYTE + 1));
        const saveButton = section.getByRole('button', {name: 'Save'});
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

        // # Restore the maximum file size
        await adminClient.patchConfig({
            FileSettings: {MaxFileSize: originalMaxFileSize},
        } as Partial<AdminConfig>);
    },
);
