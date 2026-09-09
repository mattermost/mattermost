// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The WysiwygEditor feature flag is read-only at runtime on local dev servers,
// so it must be set at server start with MM_FEATUREFLAGS_WYSIWYGEDITOR=true.
// These tests only toggle the per-user preference.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test('MM-69305 WYSIWYG editor is not mounted when user preference is off', TAGS, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    await expect(channelsPage.centerView.postCreate.input).toHaveJSProperty('tagName', 'TEXTAREA');
    await expect(page.locator('.WysiwygEditor')).toHaveCount(0);
});

test('MM-69305 WYSIWYG editor mounts when the user preference is enabled', TAGS, async ({pw}) => {
    const {user, userClient, team} = await pw.initSetup();
    await setWysiwygUserPreference(userClient, user.id, true);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    const editor = new WysiwygEditor(page.getByTestId('post-create'));
    await editor.toBeVisible();
    await expect(page.locator('.WysiwygEditor .ProseMirror')).toHaveCount(1);
});

test('preference toggle in Advanced Settings switches between Markdown and Rich text', TAGS, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    await expect(channelsPage.centerView.postCreate.input).toHaveJSProperty('tagName', 'TEXTAREA');

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
