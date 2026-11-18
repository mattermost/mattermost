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

import {
    Api,
    expect,
    getAdminClient,
    labelChip,
    openChannel,
    openNewChannelModal,
    settle,
    test,
    DefaultChannel,
    Msg,
} from '@mattermost/playwright-lib';

import {
    deleteClassificationFieldsIfExist,
    setupClassificationWithChannelField,
} from '../../channels/channel_classification/helpers';

import {findChannelField} from './applies_to_helpers';
import {
    defined,
    openClassificationAttribute,
    requireGlobalAttributesEnabled,
    saveInPlace,
} from './global_attributes_helpers';

const FEATURE_FLAGS = {ChannelAttributes: true, ChannelAttributesRequired: true, ClassificationMarkings: true};

test.describe(
    'System Console - the classification attribute page',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        test.describe.configure({mode: 'serial'});

        test.afterAll(async () => {
            const {adminClient} = await getAdminClient();
            if (!adminClient) {
                return;
            }
            await deleteClassificationFieldsIfExist(adminClient);
        });

        /**
         * @objective Verify the definition is shown read-only, with the levels editor a link away.
         */
        test('shows the definition read-only and links to Classification Markings', async ({pw}) => {
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            const {levels} = await setupClassificationWithChannelField(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = await openClassificationAttribute(app);

            // * Every level is listed, and none of them is editable here
            for (const level of levels) {
                await expect(classification.levels).toContainText(level.name);
            }

            // The display name is shown, but as a disabled field.
            await expect(classification.name.container).toBeVisible();
            await expect(classification.name.container).not.toBeEditable();

            // * The one place levels can be changed is a link away
            await expect(classification.markings.container).toHaveHrefPath(
                '/admin_console/site_config/classification_markings',
            );
        });

        /**
         * @objective Verify a display location chosen here reaches the channel field and the channel header.
         */
        test('applies a header chip to channels once Header is chosen', async ({pw}) => {
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            const {levels} = await setupClassificationWithChannelField(adminClient);
            const {team, user} = await pw.initSetup();

            const {app: admin} = await pw.testBrowser.login(adminUser);
            const classification = await openClassificationAttribute(admin);
            await classification.appliesTo.channel.settings.location('display_label_header').check();
            await expect(classification.appliesTo.channel.settings.location('display_label_header')).toBeChecked();
            await saveInPlace(admin);

            // * The choice landed on the linked channel field
            const channelField = defined(await findChannelField(adminClient, 'classification'), 'the channel field');
            expect(channelField.attrs?.actions).toEqual(['display_label_header']);

            // # Give a channel a classification, then look at it as a member
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `classification-attr-${pw.random.id()}`,
                display_name: 'Classification Attr',
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: channelField.id, value: levels[0].id},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            const app = await openChannel(pw, user, {team, channel});

            // * The header carries the chip the console asked for
            await expect(await labelChip(app.channelHeader.attributes, levels[0].name)).toBeVisible();
        });

        /**
         * @objective Verify classification is asked for at channel creation only once Required is on.
         *
         * Classification is a channel attribute like any other: the create dialog asks
         * only for required attributes, and an optional one is added later from Channel Info.
         */
        test('asks for classification at channel creation only once Required is on', async ({pw}) => {
            // The Required toggle this test flips only renders in the System Console
            // while this kill switch is on (model.IsChannelAttributesRequiredEnabled).
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const {channelFieldId} = await setupClassificationWithChannelField(adminClient);
            const {team} = await pw.initSetup();

            const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

            // * Optional attributes are not asked for at creation, so Create is free
            const modal = await openNewChannelModal(app);
            await modal.name.container.fill(`Optional Classification ${pw.random.id()}`);
            await expect(modal.attributes.attribute({id: channelFieldId})).toHaveCount(0);
            await expect(modal.confirmButton).toBeEnabled();
            await modal.cancelButton.click();
            await expect(modal.name.container).not.toBeVisible();
        });

        /**
         * @objective Verify a channel classification field already marked required
         * demands a level before Create is enabled. The console toggle flow itself is
         * covered by required_gate.spec.ts.
         *
         * The helper creates the field optional, backfills every active channel with a
         * level, then PATCHes it to required. The server rejects that transition while
         * any active channel lacks a value, so the backfill is what lets it through on a
         * shared e2e server.
         */
        test('demands a classification level at creation once the field is required', async ({pw}) => {
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const {levels, channelFieldId} = await setupClassificationWithChannelField(adminClient, undefined, true);
            const {team} = await pw.initSetup();

            const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});
            const modal = await openNewChannelModal(app);
            await modal.name.container.fill(`Required Classification ${pw.random.id()}`);

            // * Now it is asked for, and holds up Create until a level is chosen
            const attribute = modal.attributes.attribute({id: channelFieldId});
            await expect(attribute).toBeVisible();
            await expect(modal.confirmButton).toBeDisabled();
            await attribute.valueChoiceCombobox.press('ArrowDown');

            // * Highest rank first, with a coloured swatch on every level.
            await expect(attribute.choiceList).toHaveKeys([...levels].reverse().map((level) => level.id));
            for (const level of levels) {
                await expect(attribute.choice(level).swatch).toBeVisible();
            }

            await attribute.choice(levels[0]).container.select();
            await expect(attribute.valueChoiceCombobox).toHaveValue(levels[0].name);
            await expect(attribute.swatch).toHaveCount(1);
            await expect(modal.confirmButton).toBeEnabled();
        });

        /**
         * @objective Verify unticking Banner actually stops the banner.
         *
         * Classification banners on a field carrying no display locations at all, which is
         * what keeps a server that predates this page behaving as it did. A configured
         * field has to be obeyed instead, or the Banner checkbox would do nothing.
         */
        test('stops bannering when the display locations exclude the banner', async ({pw}) => {
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            const {levels} = await setupClassificationWithChannelField(adminClient);
            const {team, user} = await pw.initSetup();

            const channelFieldBefore = defined(
                await findChannelField(adminClient, 'classification'),
                'the channel field',
            );
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `classification-banner-${pw.random.id()}`,
                display_name: 'Classification Banner',
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: channelFieldBefore.id, value: levels[0].id},
            ] as Parameters<typeof adminClient.patchPropertyValues>[3]);

            // # Configure Header only — deliberately not the banner
            const {app: admin} = await pw.testBrowser.login(adminUser);
            const classification = await openClassificationAttribute(admin);
            await classification.appliesTo.channel.settings.location('display_label_header').check();
            await expect(classification.appliesTo.channel.settings.location('display_label_header')).toBeChecked();
            await saveInPlace(admin);

            const app = await openChannel(pw, user, {team, channel});

            // * The Header location took effect, and there is no banner even though
            // * the channel has a classification
            await expect(await labelChip(app.channelHeader.attributes, levels[0].name)).toBeVisible();
            await expect(app.center.channelBanner).toHaveCount(0);
        });

        /**
         * @objective Verify removing the resource asks first, and that a removal is not undone by an unrelated save.
         */
        test('removes the Channels resource only after confirming, and keeps it removed', async ({pw}) => {
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
            const {levels: seededLevels} = await setupClassificationWithChannelField(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = await openClassificationAttribute(app);
            const {channel} = classification.appliesTo;

            // # Ask to remove, then back out
            let confirm = await channel.removeButton.clickTo(classification.removeChannelModal);
            await confirm.cancelButton.click();

            // * Nothing was deleted
            await expect(confirm).not.toBeVisible();
            await expect(channel).toBeVisible();
            expect(await findChannelField(adminClient, 'classification')).toBeDefined();

            // # Ask again and confirm
            confirm = await channel.removeButton.clickTo(classification.removeChannelModal);
            await expect(confirm.confirmButton).toHaveMessage(
                Msg.admin.global_attributes.classification.remove_channels.confirm,
            );
            await settle(confirm.confirmButton, {
                wait: Api.DeletePropertyField,
                params: {group_name: 'access_control', object_type: 'channel'},
            }).click();

            // * The field is gone, and the card offers to add it back
            await expect(classification.appliesTo.addButton).toBeVisible();
            await expect(channel).toHaveCount(0);
            expect(await findChannelField(adminClient, 'classification')).toBeUndefined();

            // * Saving the Classification Markings page does not reinstate it: the field is
            // * created on the transition into enabled, not on every save
            await app.page.goto('/admin_console/site_config/classification_markings');
            const {levels, savePanel} = app.admin.classification;
            const firstLevel = levels.row(seededLevels[0].id);
            await expect(firstLevel).toBeVisible();

            // Save only enables once something changes, so the save under test needs an
            // edit -- one with nothing to do with the Channels resource. The cell keeps the
            // typing local and only reports it on blur, so the edit has to be committed.
            const levelName = firstLevel.nameTextbox.locator;
            await levelName.fill('UNCLASSIFIED EDITED');
            await levelName.blur();

            await expect(savePanel.saveButton).toBeEnabled();
            await settle(savePanel.saveButton, {
                wait: Api.UpdatePropertyField,
                params: {group_name: 'access_control', object_type: 'template'},
            }).click();
            await expect(savePanel.saveButton).toBeSaved();

            expect(await findChannelField(adminClient, 'classification')).toBeUndefined();
        });

        /**
         * @objective Verify the missing-values banner and the notify preview call the
         * attribute Classification, as the page does, rather than "this attribute" or
         * its internal name.
         */
        test('names Classification in the missing-values banner and the notify preview', async ({pw}) => {
            await pw.ensureFeatureFlag(FEATURE_FLAGS);
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            await setupClassificationWithChannelField(adminClient);
            const {team} = await pw.initSetup();

            // A channel with no classification, so the banner has something to count.
            await adminClient.createChannel({
                team_id: team.id,
                name: `classification-missing-${pw.random.id()}`,
                display_name: 'Classification Missing',
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {appliesToChannels} = globalAttributes;

            await globalAttributes.gotoClassificationAttribute();

            // * The banner names Classification
            await expect(appliesToChannels.missingValuesBanner).toContainText('a Classification value');
            await expect(appliesToChannels.missingValuesBanner).not.toContainText('this attribute');

            // * So does the notify preview, formatted rather than as markdown
            const modal = await appliesToChannels.openNotifyChannelAdminsModal();
            await expect(modal.container).toContainText('a Classification value');
            await expect(modal.messagePreview.locator('strong')).toHaveText('Classification');
            await expect(modal.messagePreview).not.toContainText('**');
            await modal.cancel();
        });
    },
);
