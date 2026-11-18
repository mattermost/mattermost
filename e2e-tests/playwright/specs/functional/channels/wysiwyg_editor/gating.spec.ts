// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// These tests only toggle the per-user preference; the server flag is enabled below.

import {Api, expect, settle, setWysiwygUserPreference, test} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.beforeEach(async ({pw}) => {
    await pw.ensureFeatureFlag('WysiwygEditor', true);
});

/**
 * @objective Verify the Markdown textarea stays when the user's preference is off.
 */
test('MM-69305 WYSIWYG editor is not mounted when user preference is off', TAGS, async ({pw}) => {
    const {user, team, offTopic} = await pw.initSetup();

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    // * Verify the composer is the Markdown textarea
    await expect(app.center.postCreate.message.container).toHaveJSProperty('tagName', 'TEXTAREA');
});

/**
 * @objective Verify the rich-text editor replaces the textarea when the user's preference is on.
 */
test('MM-69305 WYSIWYG editor mounts when the user preference is enabled', TAGS, async ({pw}) => {
    const {user, userClient, team, offTopic} = await pw.initSetup();
    await setWysiwygUserPreference(userClient, user.id, true);
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    // * Verify the composer is the rich-text editor
    await expect(app.center.postCreate.message.container).not.toHaveJSProperty('tagName', 'TEXTAREA');
    await expect(app.center.postCreate.message.container).toHaveAttribute('contenteditable', 'true');
});

/**
 * @objective Verify Settings > Advanced switches the composer from Markdown to rich text.
 */
test('preference toggle in Advanced Settings switches between Markdown and Rich text', TAGS, async ({pw}) => {
    const {user, team, offTopic} = await pw.initSetup();

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});
    await expect(app.center.postCreate.message.container).toHaveJSProperty('tagName', 'TEXTAREA');

    // # Choose rich text in Settings > Advanced and save
    await app.globalHeader.settingsButton.clickTo(app.userSettingsModal);
    await app.userSettingsModal.tabs.tab('advanced').select();
    await expect(app.userSettingsModal.tabs.tab('advanced')).toBeSelected();
    const section = app.settings.advanced.section('wysiwygEditor');
    await expect(section.editButton).toBeVisible();
    const richText = section.wysiwygEditor.option('true');
    await section.editButton.clickTo(richText);
    await richText.check();
    await expect(richText).toBeChecked();
    await settle(section.saveButton, {wait: Api.UpdatePreferences}).click();
    await app.userSettingsModal.closeButton.click();
    await expect(app.userSettingsModal).not.toBeVisible();

    // * Verify the composer is now the rich-text editor
    await expect(app.center.postCreate.message.container).toHaveAttribute('contenteditable', 'true');
    await expect(app.center.postCreate.message.container).toHaveAttribute('role', 'textbox');
});

/**
 * @objective Verify the preference helper can be applied twice.
 */
test('helper: setWysiwygUserPreference is idempotent', TAGS, async ({pw}) => {
    const {user, userClient} = await pw.initSetup();

    await setWysiwygUserPreference(userClient, user.id, true);
    await setWysiwygUserPreference(userClient, user.id, true);

    const prefs = (await userClient.getMyPreferences()) as unknown as Array<{
        category: string;
        name: string;
        value: string;
    }>;
    const match = prefs.find((p) => p.category === 'display_settings' && p.name === 'wysiwyg_editor');
    expect(match?.value).toBe('true');
});
