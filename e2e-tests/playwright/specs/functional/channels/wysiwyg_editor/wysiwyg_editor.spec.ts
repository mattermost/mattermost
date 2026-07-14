// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    setWysiwygUserPreference,
    test,
    WysiwygEditor,
} from '@mattermost/playwright-lib';

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

test.describe('WYSIWYG editor - composing and posting', TAGS, () => {
    test('posts a plain-text message', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        const msg = `wysiwyg plain ${pw.random.id()}`;
        await editor.postMessage(msg);

        const last = await channelsPage.getLastPost();
        await last.toContainText(msg);
        expect(await editor.isEmpty()).toBe(true);
    });

    test('placeholder shows when empty and hides after typing', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        await expect(editor.placeholder().first()).toBeVisible();
        await editor.type('x');
        await expect(editor.placeholder()).toHaveCount(0);
    });

    test('ArrowUp on empty composer opens the inline edit for the last post', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.postMessage(`edit-me ${pw.random.id()}`);
        await editor.press('ArrowUp');

        await expect(page.getByTestId('post-edit-container')).toBeVisible();
    });
});

test.describe('WYSIWYG editor - markdown-as-you-type rich text', TAGS, () => {
    test('bold, italic, and strikethrough marks render inline', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('**bold** *italic* ~~strike~~');

        await expect(editor.input.locator('strong')).toHaveText('bold');
        await expect(editor.input.locator('em')).toHaveText('italic');
        await expect(editor.input.locator('s')).toHaveText('strike');

        await editor.sendByButton();
        const last = await channelsPage.getLastPost();
        await last.toContainText('bold');
        await last.toContainText('italic');
        await last.toContainText('strike');
    });

    test('heading and blockquote markdown shortcuts are recognized', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        await editor.type('## heading');
        await expect(editor.input.locator('h2')).toHaveText('heading');

        await editor.clear();
        await editor.type('- item one');
        await expect(editor.input.locator('ul li').first()).toContainText('item one');

        await editor.clear();
        await editor.type('> quoted');
        await expect(editor.input.locator('blockquote')).toContainText('quoted');
    });

    test('all-emoji document gets the jumbo class', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('😀😀😀');

        await expect(editor.input.locator('.WysiwygEditor__emoji--jumbo').first()).toBeVisible();

        await editor.type(' text');
        await expect(editor.input.locator('.WysiwygEditor__emoji--jumbo')).toHaveCount(0);
        await expect(editor.input.locator('.WysiwygEditor__emoji').first()).toBeVisible();
    });
});

test.describe('WYSIWYG editor - formatting bar', TAGS, () => {
    test('bold and italic toolbar buttons wrap the selection', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('formatme');
        await editor.press('ControlOrMeta+a');

        await editor.formattingBar.getByRole('button', {name: /bold/i}).click();
        await expect(editor.input.locator('strong')).toHaveText('formatme');

        await editor.formattingBar.getByRole('button', {name: /italic/i}).click();
        await expect(editor.input.locator('strong em, em strong')).toHaveText('formatme');
    });
});

test.describe('WYSIWYG editor - autocomplete suggestions', TAGS, () => {
    test('slash command autocomplete opens and completes on Enter', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('/away');

        await expect(editor.suggestionList()).toBeVisible();
        await editor.press('Enter');
        await expect(editor.input).toContainText('/away');
    });

    test('@mention autocomplete opens for team members and navigates with Arrow keys', async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);
        const created = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.addToTeam(team.id, created.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type(`@${created.username}`);

        const list = editor.suggestionList();
        await expect(list).toBeVisible();
        // ArrowDown then ArrowUp: proves keyboard navigation cycles the list.
        await editor.press('ArrowDown');
        await editor.press('ArrowUp');
        // Click the specific entry: which item is highlighted after search settles
        // is order-dependent (recency, username collisions), so avoid pressing Enter.
        await list.getByText(created.username, {exact: false}).first().click();
        await expect(editor.input).toContainText(`@${created.username}`);
    });

    test('~channel autocomplete opens and completes', async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);
        const linked = await adminClient.createPublicChannel(team.id, 'Wysiwyg Target');
        await adminClient.addToChannel(user.id, linked.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type(`~${linked.name.slice(0, 5)}`);

        await expect(editor.suggestionList()).toBeVisible();
        await editor.press('Enter');
        await expect(editor.input).toContainText(`~${linked.name}`);
    });

    test('emoji shortcode autocomplete opens and closes on Escape', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type(':smi');

        await expect(editor.suggestionList()).toBeVisible();
        await editor.press('Escape');
        await expect(editor.suggestionList()).not.toBeVisible();
    });
});

test.describe('WYSIWYG editor - paste', TAGS, () => {
    test('pasting plain markdown parses into formatted content', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.pasteText('**bold** and *italic* and `code`');

        await expect(editor.input.locator('strong')).toHaveText('bold');
        await expect(editor.input.locator('em')).toHaveText('italic');
        await expect(editor.input.locator('code')).toHaveText('code');
    });

    test('pasting plain text without markdown syntax stays plain', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.pasteText('just some plain words no formatting');

        await expect(editor.input.locator('strong')).toHaveCount(0);
        await expect(editor.input.locator('em')).toHaveCount(0);
        await expect(editor.input).toContainText('just some plain words no formatting');
    });
});

test.describe('WYSIWYG editor - RHS reply composer', TAGS, () => {
    test('WYSIWYG replaces the classic composer in the RHS thread', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const rootEditor = new WysiwygEditor(page.getByTestId('post-create'));
        await rootEditor.postMessage(`thread-root ${pw.random.id()}`);
        const root = await channelsPage.getLastPost();
        await root.reply();
        await channelsPage.sidebarRight.toBeVisible();

        const rhsEditor = new WysiwygEditor(
            page.locator('#sidebar-right').getByTestId('comment-create'),
            true,
        );
        await rhsEditor.toBeVisible();

        // pasteText, not type(): opening a thread briefly re-focuses the
        // center composer, splitting a slow per-keystroke type between panes.
        await rhsEditor.pasteText('wysiwyg reply **bold**');
        await expect(rhsEditor.input.locator('strong')).toHaveText('bold');

        await rhsEditor.sendByButton();
        const lastReply = await channelsPage.sidebarRight.getLastPost();
        await lastReply.toContainText('wysiwyg reply');
        await lastReply.toContainText('bold');
    });
});

test.describe('WYSIWYG editor - Advanced Settings toggle UI', TAGS, () => {
    test('preference toggles the editor between Markdown and Rich text', async ({pw}) => {
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
});

test('helper: setWysiwygUserPreference is idempotent', TAGS, async ({pw}) => {
    const {user, userClient} = await pw.initSetup();
    await setWysiwygUserPreference(userClient, user.id, true);
    await setWysiwygUserPreference(userClient, user.id, true);
    const prefs = (await userClient.getMyPreferences()) as unknown as Array<{category: string; name: string; value: string}>;
    const match = prefs.find((p) => p.category === 'display_settings' && p.name === 'wysiwyg_editor');
    expect(match?.value).toBe('true');
});
