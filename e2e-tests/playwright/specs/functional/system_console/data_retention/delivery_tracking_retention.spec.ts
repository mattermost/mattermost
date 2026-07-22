// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';

import {expect, test} from '@mattermost/playwright-lib';

const globalPolicyUrl = '/admin_console/compliance/data_retention_settings/global_policy';

// The PostDeliveryTracking feature flag is server-managed (read-only via the config API), so the
// tests can't toggle it. They assume it is enabled and skip otherwise; the retention itself is
// enabled/disabled through the patchable DataRetentionSettings config.
test.describe('System Console > Data Retention > Post delivery tracking retention', () => {
    test(
        'shows the configured retention when delivery tracking deletion is enabled',
        {tag: ['@data_retention', '@delivery_tracking']},
        async ({pw}) => {
            await pw.skipIfNoLicense();
            await pw.skipIfFeatureFlagNotSet('PostDeliveryTracking', true);

            const {adminUser, adminClient} = await pw.initSetup();

            await adminClient.patchConfig({
                DataRetentionSettings: {
                    EnableDeliveryTrackingDeletion: true,
                    DeliveryTrackingRetentionHours: 720,
                },
            } as unknown as Partial<AdminConfig>);

            const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await systemConsolePage.sidebar.compliance.dataRetentionPolicies.click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByText('Delivery tracking', {exact: true})).toBeVisible();
            await expect(page.getByTestId('global_delivery_tracking_retention_cell')).toHaveText('30 days');

            await page.goto(globalPolicyUrl);
            await page.waitForLoadState('networkidle');
            await expect(page.locator('#global_delivery_tracking_dropdown')).toBeVisible();
            await expect(page.locator('#delivery_tracking_retention_input')).toHaveValue('30');
        },
    );

    test(
        'shows keep forever when delivery tracking deletion is disabled',
        {tag: ['@data_retention', '@delivery_tracking']},
        async ({pw}) => {
            await pw.skipIfNoLicense();
            await pw.skipIfFeatureFlagNotSet('PostDeliveryTracking', true);

            const {adminUser, adminClient} = await pw.initSetup();

            await adminClient.patchConfig({
                DataRetentionSettings: {
                    EnableDeliveryTrackingDeletion: false,
                },
            } as unknown as Partial<AdminConfig>);

            const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await systemConsolePage.sidebar.compliance.dataRetentionPolicies.click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByText('Delivery tracking', {exact: true})).toBeVisible();
            await expect(page.getByTestId('global_delivery_tracking_retention_cell')).toHaveText('Keep forever');

            await page.goto(globalPolicyUrl);
            await page.waitForLoadState('networkidle');
            await expect(page.locator('#global_delivery_tracking_dropdown')).toBeVisible();
        },
    );

    test(
        'saves the delivery tracking retention period from the global policy form',
        {tag: ['@data_retention', '@delivery_tracking']},
        async ({pw}) => {
            await pw.skipIfNoLicense();
            await pw.skipIfFeatureFlagNotSet('PostDeliveryTracking', true);

            const {adminUser, adminClient} = await pw.initSetup();

            await adminClient.patchConfig({
                DataRetentionSettings: {
                    EnableDeliveryTrackingDeletion: false,
                    DeliveryTrackingRetentionHours: 0,
                },
            } as unknown as Partial<AdminConfig>);

            const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await page.goto(globalPolicyUrl);
            await page.waitForLoadState('networkidle');

            const row = page.locator('#global_delivery_tracking_dropdown');
            await expect(row).toBeVisible();

            await row.locator('.delivery_tracking_retention_dropdown__control').click();
            await page.locator('.delivery_tracking_retention_dropdown__option', {hasText: 'Days'}).click();
            await page.locator('#delivery_tracking_retention_input').fill('30');

            await page.getByRole('button', {name: 'Save'}).click();

            await pw.waitUntil(async () => {
                const cfg = await adminClient.getConfig();
                return (
                    cfg.DataRetentionSettings.EnableDeliveryTrackingDeletion === true &&
                    cfg.DataRetentionSettings.DeliveryTrackingRetentionHours === 720
                );
            });

            const cfg = await adminClient.getConfig();
            expect(cfg.DataRetentionSettings.EnableDeliveryTrackingDeletion).toBe(true);
            expect(cfg.DataRetentionSettings.DeliveryTrackingRetentionHours).toBe(720);
        },
    );
});
