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
import {requireGlobalAttributesEnabled} from './global_attributes_helpers';

test.describe(
    'System Console - the classification attribute page',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        // Shares the server-wide ClassificationMarkings flag with its sibling specs.
        test.describe.configure({mode: 'serial'});

        let originalClassificationMarkings: boolean | undefined;

        test.beforeAll(async () => {
            const {adminClient} = await getAdminClient();
            const {FeatureFlags} = await adminClient.getConfig();
            originalClassificationMarkings = FeatureFlags.ClassificationMarkings === true;
            await setClassificationMarkingsFeatureFlag(adminClient, true);
        });

        test.afterAll(async () => {
            const {adminClient} = await getAdminClient();
            if (!adminClient) {
                return;
            }
            await deleteClassificationFieldsIfExist(adminClient);
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
            await expect(
                systemConsolePage.page.getByTestId('classificationAttribute').getByRole('textbox'),
            ).toHaveCount(0);

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
                {field_id: channelField!.id, value: levels[0].id},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * The header carries the chip the console asked for
            await expect(channelsPage.centerView.header.attributes.chip(levels[0].name)).toBeVisible();
        });

        /**
         * @objective Verify classification is offered at channel creation while optional.
         *
         * Optional attributes are otherwise kept off the create dialog. Classification is
         * the exception: it has always been offered there, and its own control in that
         * dialog is suppressed once the ChannelAttributes flag is on, so the generic
         * section has to carry it either way.
         */
        test('offers classification at channel creation while optional', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            await setupClassificationWithChannelField(adminClient);
            const {team} = await pw.initSetup();

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            // * Offered while optional, and Create is not held up by leaving it empty
            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Optional Classification ${pw.random.id()}`);
            await expect(channelsPage.page.getByTestId('channelAttribute-classification')).toBeVisible();
            await expect(modal.createButton).toBeEnabled();
            await modal.cancel();
        });

        /**
         * @objective Verify a channel classification field already marked required (as
         * opposed to flipped on afterward — see MM-70717's required_gate.spec.ts for that)
         * demands a level before Create is enabled.
         *
         * `required` is seeded at field-creation time rather than toggled on afterward
         * through the console: MM-70717 blocks that PATCH transition while any active
         * channel on the server lacks a value for the field, which on a shared e2e server
         * is effectively guaranteed for a brand-new field. Seeding it at creation exercises
         * exactly the same create-time enforcement this test has always been about, without
         * depending on every other channel already on the server being compliant.
         */
        test('demands a classification level at creation once the field is required', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

            const {levels} = await setupClassificationWithChannelField(adminClient, undefined, true);
            const {team} = await pw.initSetup();

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Required Classification ${pw.random.id()}`);

            // * Holds up Create until a level is chosen
            await expect(modal.createButton).toBeDisabled();
            await channelsPage.page.getByTestId('channelAttribute-classification').click();
            await channelsPage.page.getByText(levels[0].name, {exact: true}).click();
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
                {field_id: channelFieldBefore!.id, value: levels[0].id},
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
            await expect(page.getByTestId('channel_banner_container')).toHaveCount(0);
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

            // Save only enables once something changes, so the save under test needs an
            // edit -- one with nothing to do with the Channels resource. The cell keeps the
            // typing local and only reports it on blur, so the edit has to be committed.
            const levelName = page.getByRole('textbox', {name: 'Classification level name'}).first();
            await levelName.fill('UNCLASSIFIED EDITED');
            await levelName.blur();

            await page.getByTestId('saveSetting').click();
            await expect(page.getByTestId('saveSetting')).toBeDisabled();

            expect(await findChannelField(adminClient, 'classification')).toBeUndefined();
        });
    },
);
