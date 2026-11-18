// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// These tests only toggle the per-user preference; the server flag is enabled below.

import {expect, setWysiwygUserPreference, test} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.beforeEach(async ({pw}) => {
    await pw.ensureFeatureFlag('WysiwygEditor', true);
});

test('MM-69305 WYSIWYG editor is not mounted when user preference is off', TAGS, async ({pw}) => {
    const {user, team, offTopic} = await pw.initSetup();

    const {page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    await expect(app.center.postCreate.message.container).toHaveJSProperty('tagName', 'TEXTAREA');
    await expect(page.locator('.WysiwygEditor')).toHaveCount(0);
});

test('MM-69305 WYSIWYG editor mounts when the user preference is enabled', TAGS, async ({pw}) => {
    const {user, userClient, team, offTopic} = await pw.initSetup();
    await setWysiwygUserPreference(userClient, user.id, true);

    const {page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    await expect(app.center.postCreate.message.container).toBeVisible();
    await expect(page.locator('.WysiwygEditor .ProseMirror')).toHaveCount(1);
});

test('preference toggle in Advanced Settings switches between Markdown and Rich text', TAGS, async ({pw}) => {
    const {user, team, offTopic} = await pw.initSetup();

    const {channelsPage, page, app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    await expect(app.center.postCreate.message.container).toHaveJSProperty('tagName', 'TEXTAREA');

    const settings = await channelsPage.openSettings();
    await settings.advancedTab.click();
    await expect(page.locator('#wysiwygEditorEdit')).toBeVisible();
    await page.locator('#wysiwygEditorEdit').click();
    await page.locator('#wysiwygEditorRich').check();
    await page.getByRole('button', {name: 'Save', exact: true}).click();
    await settings.closeButton.click();

    await expect(page.locator('.WysiwygEditor .ProseMirror')).toHaveCount(1);
});

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
