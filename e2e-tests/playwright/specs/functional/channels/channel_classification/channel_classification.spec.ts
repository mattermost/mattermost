// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Channel Classification E2E tests.
 * Tests the classification level assignment feature on both new and existing channels.
 *
 * Prerequisites: Enterprise-tier license + ClassificationMarkings feature flag enabled.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {TEST_LEVELS, setClassificationMarkingsFeatureFlag, setupClassificationWithChannelField} from './helpers';

test.describe('Channel Classification - New channel creation', () => {
    test('Enabling classification toggle without selecting values prevents channel creation', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        await setupClassificationWithChannelField(adminClient);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.fillDisplayName(`test-${pw.random.id()}`);
        await newChannelModal.publicTypeButton.click();

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Create button should be disabled (no classification level selected, no banner text)
        await expect(newChannelModal.createButton).toBeDisabled();
    });

    test('Classification dropdown displays the correct levels from the template', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        await setupClassificationWithChannelField(adminClient);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.fillDisplayName(`test-${pw.random.id()}`);

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Open the classification dropdown
        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();

        // Verify all test levels are present in the dropdown menu
        const menu = channelsPage.page.locator('.DropDown__menu');
        await expect(menu).toBeVisible();
        for (const level of TEST_LEVELS) {
            await expect(menu.getByText(level.name, {exact: true})).toBeVisible();
        }
    });

    test('User can append text to the Banner Text field after selecting a classification', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        const setup = await setupClassificationWithChannelField(adminClient);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.fillDisplayName(`test-${pw.random.id()}`);

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Select a classification level (SECRET)
        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(setup.levels[2].name, {exact: true}).click();

        // Banner text should be auto-populated with the bold level name
        const bannerTextbox = channelsPage.page.locator('#channel_classification_banner_text_textbox');
        await expect(bannerTextbox).toBeVisible();
        const currentValue = await bannerTextbox.inputValue();
        expect(currentValue).toContain(setup.levels[2].name);

        // Append custom text to the banner
        await bannerTextbox.click();
        await bannerTextbox.press('End');
        await bannerTextbox.pressSequentially(' - Custom suffix');

        const updatedValue = await bannerTextbox.inputValue();
        expect(updatedValue).toContain('Custom suffix');
    });

    test('Creating channel with classification shows banner with correct color', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        const setup = await setupClassificationWithChannelField(adminClient);
        const selectedLevel = setup.levels[2]; // SECRET

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.fillDisplayName(`classified-${pw.random.id()}`);
        await newChannelModal.publicTypeButton.click();

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Select the classification level
        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(selectedLevel.name, {exact: true}).click();

        // Wait for banner text to auto-populate, then create the channel
        const bannerTextbox = channelsPage.page.locator('#channel_classification_banner_text_textbox');
        await expect(bannerTextbox).toBeVisible();
        await expect(bannerTextbox).not.toHaveValue('');

        await newChannelModal.create();

        // Should be redirected to the new channel
        await expect(channelsPage.page).toHaveURL(/\/channels\//);
        await channelsPage.centerView.toBeVisible();

        // Channel banner should be visible with the classification color
        // The banner text is markdown bold: **SECRET** renders as just "SECRET"
        await channelsPage.centerView.assertChannelBanner(selectedLevel.name, selectedLevel.color);
    });
});

test.describe('Channel Classification - Existing channel settings', () => {
    test('Classification toggle can be enabled from channel settings', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        await setupClassificationWithChannelField(adminClient);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        await channelsPage.newChannel(pw.random.id(), 'O');

        const channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openConfigurationTab();

        // The classification toggle should be available
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await expect(classificationToggle).toBeVisible();

        // Toggle it on
        const classes = await classificationToggle.getAttribute('class');
        if (!classes?.includes('active')) {
            await classificationToggle.click();
        }

        // Toggle should now be active
        await expect(classificationToggle).toHaveClass(/active/);
    });

    test('Classification level can be set once toggle is enabled', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        const setup = await setupClassificationWithChannelField(adminClient);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        await channelsPage.newChannel(pw.random.id(), 'O');

        const channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openConfigurationTab();

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Classification level dropdown should be visible
        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await expect(dropdownContainer).toBeVisible();

        // Open dropdown and select a level
        await dropdownContainer.click();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await expect(menu).toBeVisible();

        const selectedLevel = setup.levels[1]; // CONFIDENTIAL
        await menu.getByText(selectedLevel.name, {exact: true}).click();

        // The dropdown should now show the selected value
        await expect(dropdownContainer.getByText(selectedLevel.name)).toBeVisible();
    });

    test('Selecting classification locks banner toggle active and disabled, with matching color', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        const setup = await setupClassificationWithChannelField(adminClient);
        const selectedLevel = setup.levels[2]; // SECRET

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        await channelsPage.newChannel(pw.random.id(), 'O');

        const channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openConfigurationTab();

        // Enable classification and select a level
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(selectedLevel.name, {exact: true}).click();

        // The channel banner toggle should now be forced active and disabled
        const bannerToggle = channelsPage.page.getByTestId('channelBannerToggle-button');
        await expect(bannerToggle).toBeVisible();
        await expect(bannerToggle).toHaveClass(/active/);
        await expect(bannerToggle).toBeDisabled();

        // Banner color input should be locked to the classification color
        const colorInput = channelsPage.page.locator('#channel_banner_banner_background_color_picker-inputColorValue');
        await expect(colorInput).toBeVisible();
        const colorValue = await colorInput.inputValue();
        expect(colorValue.toLowerCase().replace('#', '')).toBe(selectedLevel.color.toLowerCase().replace('#', ''));
    });

    test('Editing banner text and saving updates the banner in real time', async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'enterprise' && license.SkuShortName !== 'advanced',
            'Channel classification requires Enterprise-tier license',
        );

        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags.ClassificationMarkings !== true,
            'ClassificationMarkings feature flag could not be enabled',
        );

        const setup = await setupClassificationWithChannelField(adminClient);
        const selectedLevel = setup.levels[3]; // TOP SECRET

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        await channelsPage.newChannel(pw.random.id(), 'O');

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        // Enable classification and select a level
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(selectedLevel.name, {exact: true}).click();

        // Edit the banner text to a custom value
        const customBannerText = 'TOP SECRET - Handle via COMINT channels only';
        const bannerTextbox = channelsPage.page.locator('#channel_banner_banner_text_textbox');
        await expect(bannerTextbox).toBeVisible();
        await bannerTextbox.fill(customBannerText);

        // Save the changes
        await configurationTab.save();
        await channelSettingsModal.close();

        // The channel banner should now show the custom text with the classification color
        await channelsPage.centerView.assertChannelBanner(customBannerText, selectedLevel.color);
    });
});
