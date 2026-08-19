// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — classification's own attribute page.
 *
 * Classification's fields are created by the Classification Markings page, so the
 * create-only card on the New attribute page can never reach them. This page is the
 * only way to configure which resources classification applies to without the API,
 * which is what these tests exercise.
 */

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {
    deleteClassificationFieldsIfExist,
    setClassificationMarkingsFeatureFlag,
    setupClassificationWithChannelField,
} from '../../channels/channel_classification/helpers';

import {findChannelField} from './applies_to_helpers';
import {
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from './global_attributes_helpers';

test.describe('System Console - the classification attribute page', {tag: ['@system_console', '@channel_attributes']}, () => {
    // Shares the server-wide GlobalAttributes and ClassificationMarkings flags with
    // its sibling specs.
    test.describe.configure({mode: 'serial'});

    let originalGlobalAttributes: boolean | undefined;
    let originalClassificationMarkings: boolean | undefined;

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        const {FeatureFlags} = await adminClient.getConfig();
        originalGlobalAttributes = FeatureFlags.GlobalAttributes === true;
        originalClassificationMarkings = FeatureFlags.ClassificationMarkings === true;
        await setClassificationMarkingsFeatureFlag(adminClient, true);
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient();
        if (!adminClient) {
            return;
        }
        await deleteClassificationFieldsIfExist(adminClient);
        if (originalGlobalAttributes !== undefined) {
            await setGlobalAttributesFeatureFlag(adminClient, originalGlobalAttributes);
        }
        if (originalClassificationMarkings !== undefined) {
            await setClassificationMarkingsFeatureFlag(adminClient, originalClassificationMarkings);
        }
    });

    /**
     * @objective Verify the definition is shown read-only, with the levels editor a link away.
     */
    test('shows the definition read-only and links to Classification Markings', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {levels} = await setupClassificationWithChannelField(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {globalAttributes} = systemConsolePage;

        await globalAttributes.gotoClassificationAttribute();

        // * Every level is listed, and none of them is editable here
        for (const level of levels) {
            await expect(globalAttributes.classificationLevels).toContainText(level.name);
        }
        await expect(systemConsolePage.page.getByTestId('classificationAttribute').getByRole('textbox')).toHaveCount(0);

        // * The one place levels can be changed is a link away
        await expect(globalAttributes.classificationMarkingsLink).toHaveAttribute(
            'href',
            '/admin_console/site_config/classification_markings',
        );
    });

    /**
     * @objective Verify a display location chosen here reaches the channel field and the channel header.
     */
    test('applies a header chip to channels once Header is chosen', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {levels} = await setupClassificationWithChannelField(adminClient);
        const {team, user} = await pw.initSetup();

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {globalAttributes} = systemConsolePage;

        await globalAttributes.gotoClassificationAttribute();
        await globalAttributes.appliesToChannels.setDisplayLocations(['display_label_header']);
        await globalAttributes.saveInPlace();

        // * The choice landed on the linked channel field
        const channelField = await findChannelField(adminClient, 'classification');
        expect(channelField?.attrs?.actions).toEqual(['display_label_header']);

        // # Give a channel a classification, then look at it as a member
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `classification-attr-${pw.random.id()}`,
            display_name: 'Classification Attr',
            type: 'O',
        } as Parameters<typeof adminClient.createChannel>[0]);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
            {field_id: channelField!.id, value: JSON.stringify(levels[0].id)},
        ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * The header carries the chip the console asked for
        await expect(page.getByTestId('channelAttributeLabel-classification')).toHaveText(levels[0].name);
    });

    /**
     * @objective Verify classification is offered at channel creation while optional, and demanded once Required is on.
     *
     * Optional attributes are otherwise kept off the create dialog. Classification is
     * the exception: it has always been offered there, and its own control in that
     * dialog is suppressed once the ChannelAttributes flag is on, so the generic
     * section has to carry it either way.
     */
    test('offers classification at channel creation, and demands it once Required is on', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {levels} = await setupClassificationWithChannelField(adminClient);
        const {team} = await pw.initSetup();

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // * Offered while optional, and Create is not held up by leaving it empty
        let modal = await channelsPage.openNewChannelModal();
        await modal.fillDisplayName(`Optional Classification ${pw.random.id()}`);
        await expect(channelsPage.page.getByTestId('channelAttribute-classification')).toBeVisible();
        await expect(modal.createButton).toBeEnabled();
        await modal.cancel();

        // # Mark it required on its attribute page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.globalAttributes.gotoClassificationAttribute();
        await systemConsolePage.globalAttributes.appliesToChannels.setRequired(true);
        await systemConsolePage.globalAttributes.saveInPlace();

        const asAdmin = await pw.testBrowser.login(adminUser);
        await asAdmin.channelsPage.goto(team.name);
        await asAdmin.channelsPage.toBeVisible();

        modal = await asAdmin.channelsPage.openNewChannelModal();
        await modal.fillDisplayName(`Required Classification ${pw.random.id()}`);

        // * Now it holds up Create until a level is chosen
        await expect(modal.createButton).toBeDisabled();
        await asAdmin.channelsPage.page.getByTestId('channelAttribute-classification').click();
        await asAdmin.channelsPage.page.getByText(levels[0].name, {exact: true}).click();
        await expect(modal.createButton).toBeEnabled();
    });

    /**
     * @objective Verify unticking Banner actually stops the banner.
     *
     * Classification banners on a field carrying no display locations at all, which is
     * what keeps a server that predates this page behaving as it did. A configured
     * field has to be obeyed instead, or the Banner checkbox would do nothing.
     */
    test('stops bannering when the display locations exclude the banner', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {levels} = await setupClassificationWithChannelField(adminClient);
        const {team, user} = await pw.initSetup();

        const channelFieldBefore = await findChannelField(adminClient, 'classification');
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `classification-banner-${pw.random.id()}`,
            display_name: 'Classification Banner',
            type: 'O',
        } as Parameters<typeof adminClient.createChannel>[0]);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
            {field_id: channelFieldBefore!.id, value: JSON.stringify(levels[0].id)},
        ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

        // # Configure Channel Info only — deliberately not the banner
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {globalAttributes} = systemConsolePage;
        await globalAttributes.gotoClassificationAttribute();
        await globalAttributes.appliesToChannels.setDisplayLocations(['display_label_info']);
        await globalAttributes.saveInPlace();

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // * No banner, even though the channel has a classification
        await expect(page.getByTestId('channelBanner')).toHaveCount(0);
    });

    /**
     * @objective Verify removing the resource asks first, and that a removal is not undone by an unrelated save.
     */
    test('removes the Channels resource only after confirming, and keeps it removed', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        await setupClassificationWithChannelField(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {globalAttributes} = systemConsolePage;
        const page = systemConsolePage.page;

        await globalAttributes.gotoClassificationAttribute();

        // # Ask to remove, then back out
        await globalAttributes.appliesToChannels.removeResource();
        await page.getByRole('button', {name: 'Cancel'}).click();

        // * Nothing was deleted
        await expect(globalAttributes.appliesToChannels.row).toBeVisible();
        expect(await findChannelField(adminClient, 'classification')).toBeDefined();

        // # Ask again and confirm
        await globalAttributes.appliesToChannels.removeResource();
        await page.getByRole('button', {name: 'Remove and delete values'}).click();

        // * The field is gone, and the card offers to add it back
        await expect(globalAttributes.appliesToChannels.addResourceButton).toBeVisible();
        expect(await findChannelField(adminClient, 'classification')).toBeUndefined();

        // * Saving the Classification Markings page does not reinstate it: the field is
        // * created on the transition into enabled, not on every save
        await page.goto('/admin_console/site_config/classification_markings');
        await page.getByTestId('saveSetting').click();
        await expect(page.getByTestId('saveSetting')).toBeEnabled();

        expect(await findChannelField(adminClient, 'classification')).toBeUndefined();
    });
});
