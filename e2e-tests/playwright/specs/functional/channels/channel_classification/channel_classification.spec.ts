// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Channel Classification E2E tests.
 * Tests the classification level assignment feature on both new and existing channels.
 *
 * Prerequisites: Enterprise-tier license + ClassificationMarkings feature flag enabled.
 */

import {expect, test, getAdminClient, licenseTier} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

import {
    TEST_LEVELS,
    setClassificationMarkingsFeatureFlag,
    setupClassificationWithChannelField,
    deleteClassificationFieldsIfExist,
} from './helpers';
import type {ClassificationLevel} from './helpers';

let classificationLevels: ClassificationLevel[] = [];
let setupComplete = false;

// Teams created by pw.initSetup() in each test are tracked here and deleted in
// afterEach so local environments don't accumulate stale teams across runs.
const createdTeamIds: string[] = [];

async function initSetupTracked(pw: PlaywrightExtended) {
    const setup = await pw.initSetup();
    createdTeamIds.push(setup.team.id);
    return setup;
}

test.beforeAll(async () => {
    const {adminClient} = await getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    if (licenseTier(license.SkuShortName) < 20) {
        return;
    }

    await setClassificationMarkingsFeatureFlag(adminClient, true);
    const setup = await setupClassificationWithChannelField(adminClient);
    classificationLevels = setup.levels;
    setupComplete = true;
});

test.afterAll(async () => {
    if (!setupComplete) {
        return;
    }
    const {adminClient} = await getAdminClient();
    try {
        await deleteClassificationFieldsIfExist(adminClient);
    } catch {
        // Best-effort cleanup
    }
});

test.beforeEach(async () => {
    const {adminClient} = await getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    test.skip(licenseTier(license.SkuShortName) < 20, 'Channel classification requires Enterprise-tier license');
    test.skip(!setupComplete, 'Classification levels were not set up');

    const config = await adminClient.getConfig();
    test.skip(
        config.FeatureFlags.ClassificationMarkings !== true,
        'ClassificationMarkings feature flag could not be enabled',
    );
});

test.afterEach(async () => {
    if (createdTeamIds.length === 0) {
        return;
    }
    const ids = createdTeamIds.splice(0);
    try {
        const {adminClient} = await getAdminClient({skipLog: true});
        await Promise.allSettled(ids.map((id) => adminClient.deleteTeam(id)));
    } catch {
        // Best-effort cleanup
    }
});

test.describe('Channel Classification - New channel creation', () => {
    test('Enabling classification toggle without selecting values prevents channel creation', async ({pw}) => {
        const {adminUser, team} = await initSetupTracked(pw);
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.fillDisplayName(`test-${pw.random.id()}`);
        await newChannelModal.publicTypeButton.click();

        // Create button should be enabled before toggling classification
        await expect(newChannelModal.createButton).toBeEnabled();

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Create button should be disabled (no classification level selected, no banner text)
        await expect(newChannelModal.createButton).toBeDisabled();
    });

    test('Classification dropdown displays the correct levels from the template', async ({pw}) => {
        const {adminUser, team} = await initSetupTracked(pw);
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

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
        const {adminUser, team} = await initSetupTracked(pw);
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

        const selectedLevel = classificationLevels.find((l) => l.name === 'SECRET');
        expect(selectedLevel).toBeDefined();

        const newChannelModal = await channelsPage.openNewChannelModal();
        await newChannelModal.fillDisplayName(`test-${pw.random.id()}`);

        // Enable classification toggle
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        // Select a classification level
        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(selectedLevel!.name, {exact: true}).click();

        // Banner text should be auto-populated with the bold level name
        const bannerTextbox = channelsPage.page.locator('#channel_classification_banner_text');
        await expect(bannerTextbox).toBeVisible();
        const currentValue = await bannerTextbox.inputValue();
        expect(currentValue).toContain(selectedLevel!.name);

        // Append custom text to the banner
        await bannerTextbox.click();
        await bannerTextbox.press('End');
        await bannerTextbox.pressSequentially(' - Custom suffix');

        const updatedValue = await bannerTextbox.inputValue();
        expect(updatedValue).toContain('Custom suffix');
    });

    test('Creating channel with classification shows banner with correct color', async ({pw}) => {
        const {adminUser, team} = await initSetupTracked(pw);
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

        const selectedLevel = classificationLevels.find((l) => l.name === 'SECRET');
        expect(selectedLevel).toBeDefined();

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
        await menu.getByText(selectedLevel!.name, {exact: true}).click();

        // Wait for banner text to auto-populate, then create the channel
        const bannerTextbox = channelsPage.page.locator('#channel_classification_banner_text');
        await expect(bannerTextbox).toBeVisible();
        await expect(bannerTextbox).not.toHaveValue('');

        await newChannelModal.create();

        // Should be redirected to the new channel and center view loads
        await expect(channelsPage.page).toHaveURL(/\/channels\//, {timeout: 30000});
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 30000});

        // Channel banner should be visible (allow extra time for property value fetch)
        const banner = channelsPage.page.getByTestId('channel_banner_container');
        await expect(banner).toBeVisible({timeout: 30000});

        // Verify the banner has the correct background color
        const actualBackgroundColor = await banner.evaluate((el) => {
            return window.getComputedStyle(el).getPropertyValue('background-color');
        });
        const expectedRgb = hexToRgb(selectedLevel!.color);
        expect(actualBackgroundColor).toBe(expectedRgb);

        // Verify the banner contains the classification level name (rendered from **SECRET** markdown)
        await expect(banner).toContainText(selectedLevel!.name);
    });
});

test.describe('Channel Classification - Existing channel settings', () => {
    test('Classification toggle can be enabled from channel settings', async ({pw}) => {
        const {adminUser, team, adminClient} = await initSetupTracked(pw);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: `cls-${pw.random.id()}`, displayName: `Cls ${pw.random.id()}`}),
        );
        await adminClient.addToChannel(adminUser.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

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
        const {adminUser, team, adminClient} = await initSetupTracked(pw);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: `cls-${pw.random.id()}`, displayName: `Cls ${pw.random.id()}`}),
        );
        await adminClient.addToChannel(adminUser.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

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

        const selectedLevel = classificationLevels.find((l) => l.name === 'CONFIDENTIAL');
        expect(selectedLevel).toBeDefined();
        await menu.getByText(selectedLevel!.name, {exact: true}).click();

        // The dropdown should now show the selected value
        await expect(dropdownContainer.getByText(selectedLevel!.name, {exact: true})).toBeVisible();
    });

    test('Selecting classification locks banner toggle active and disabled, with matching color', async ({pw}) => {
        const {adminUser, team, adminClient} = await initSetupTracked(pw);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: `cls-${pw.random.id()}`, displayName: `Cls ${pw.random.id()}`}),
        );
        await adminClient.addToChannel(adminUser.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

        const channelSettingsModal = await channelsPage.openChannelSettings();
        await channelSettingsModal.openConfigurationTab();

        // Enable classification and select a level
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();

        const selectedLevel = classificationLevels.find((l) => l.name === 'SECRET');
        expect(selectedLevel).toBeDefined();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(selectedLevel!.name, {exact: true}).click();

        // The channel banner toggle should now be forced active and disabled
        const bannerToggle = channelsPage.page.getByTestId('channelBannerToggle-button');
        await expect(bannerToggle).toBeVisible();
        await expect(bannerToggle).toHaveClass(/active/);
        await expect(bannerToggle).toBeDisabled();

        // Banner color input should be locked to the classification color
        const colorInput = channelsPage.page.locator('#channel_banner_banner_background_color_picker-inputColorValue');
        await expect(colorInput).toBeVisible();
        const colorValue = await colorInput.inputValue();
        expect(colorValue.toLowerCase().replace('#', '')).toBe(selectedLevel!.color.toLowerCase().replace('#', ''));
    });

    test('Disabling classification with a custom banner color preserves it server-side, and re-enabling restores the Save button', async ({
        pw,
    }) => {
        const {adminUser, team, adminClient} = await initSetupTracked(pw);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: `cls-${pw.random.id()}`, displayName: `Cls ${pw.random.id()}`}),
        );
        await adminClient.addToChannel(adminUser.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

        // Step 1: enable classification, select a level, save
        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();
        const selectedLevel = classificationLevels.find((l) => l.name === 'SECRET')!;
        await channelsPage.page.locator('.DropDown__menu').getByText(selectedLevel.name, {exact: true}).click();
        await configurationTab.save();

        // Step 2: in the same open modal, disable classification, enable a manual banner,
        // set a custom color, save. The manual banner toggle is needed because master no
        // longer auto-enables banner_info.enabled when classification is on, so the banner
        // section body (and its color input) is hidden after toggling classification off
        // until a manual banner is enabled.
        await classificationToggle.click();
        await configurationTab.enableChannelBanner();
        const customColor = 'aa00aa';
        await configurationTab.setChannelBannerBackgroundColor(customColor);
        await configurationTab.save();

        // Symptom 1 guard: color input reflects what we typed and the server persisted the custom color
        const colorInput = channelsPage.page.locator('#channel_banner_banner_background_color_picker-inputColorValue');
        await expect(colorInput).toHaveValue(`#${customColor}`);
        const persisted = await adminClient.getChannel(channel.id);
        expect(persisted.banner_info?.background_color?.toLowerCase().replace('#', '')).toBe(customColor);

        // Symptom 2 guard: re-enable classification → Save button reappears (panel transitions out of 'saved')
        await classificationToggle.click();
        const saveButton = channelsPage.page.getByTestId('SaveChangesPanel__save-btn');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();

        await channelSettingsModal.close();
    });

    test('Editing banner text and saving updates the banner in real time', async ({pw}) => {
        const {adminUser, team, adminClient} = await initSetupTracked(pw);

        const channel = await adminClient.createChannel(
            pw.random.channel({teamId: team.id, name: `cls-${pw.random.id()}`, displayName: `Cls ${pw.random.id()}`}),
        );
        await adminClient.addToChannel(adminUser.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await expect(channelsPage.page.getByTestId('channel_view')).toBeVisible({timeout: 60000});

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        // Enable classification and select a level
        const classificationToggle = channelsPage.page.getByTestId('channelClassificationToggle-button');
        await classificationToggle.click();

        const dropdownContainer = channelsPage.page.getByTestId('channelClassificationLevel');
        await dropdownContainer.click();

        const selectedLevel = classificationLevels.find((l) => l.name === 'TOP SECRET');
        expect(selectedLevel).toBeDefined();
        const menu = channelsPage.page.locator('.DropDown__menu');
        await menu.getByText(selectedLevel!.name, {exact: true}).click();

        // Edit the banner text to a custom value
        const customBannerText = 'TOP SECRET - Handle via COMINT channels only';
        const bannerTextbox = channelsPage.page.locator('#channel_banner_banner_text_textbox');
        await expect(bannerTextbox).toBeVisible();
        await bannerTextbox.fill(customBannerText);

        // Save the changes
        await configurationTab.save();
        await channelSettingsModal.close();

        // The channel banner should now show the custom text with the classification color
        const banner = channelsPage.page.getByTestId('channel_banner_container');
        await expect(banner).toBeVisible({timeout: 30000});
        await expect(banner).toContainText(customBannerText);

        const actualBackgroundColor = await banner.evaluate((el) => {
            return window.getComputedStyle(el).getPropertyValue('background-color');
        });
        expect(actualBackgroundColor).toBe(hexToRgb(selectedLevel!.color));
    });
});

function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return hex;
    }
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
}
