// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './ai_bridge_fixture';

import {koreanTestPhrase, typeHangulWithIme} from '@mattermost/playwright-lib';

// This is a real-browser correctness guard: it proves the AI Rewrite prompt is wired up and
// composes Hangul end to end. It does NOT reproduce the MM-70289 async race on its own, because
// the CDP IME helper drives composition synchronously so React never re-renders mid-composition
// (the spec therefore passes on both the buggy and fixed code). The deterministic regression guard
// for the fix is the "preserves in-progress IME composition" case in rewrite_prompt_input.test.tsx.
test('AI Rewrite custom prompt handles Korean IME input correctly', {tag: '@ai_rewrite'}, async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    // # Initialize the test server state and configure one deterministic rewrite agent.
    const {adminClient, team, user} = await pw.initSetup();

    await pw.enableAIBridgeTestMode(adminClient);
    await pw.resetAIBridgeMock(adminClient);
    const {agent} = await pw.createMockAIAgent(adminClient, {agent: {is_default: true}});
    await pw.configureAIBridgeMock(adminClient, {
        status: {available: true},
        agents: [agent],
        agent_completions: {
            rewrite: [pw.rewriteCompletion('Rewritten message')],
        },
    });

    // # Log in and go to the default channel.
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Write a draft message so the Rewrite options become available.
    await channelsPage.centerView.postCreate.writeMessage('Draft message to rewrite');

    // # Open the AI Actions menu and reveal the Rewrite submenu with the custom prompt.
    await page.getByRole('button', {name: 'AI Actions'}).click();
    await page.getByRole('menuitem', {name: 'Rewrite'}).hover();

    // # Focus the custom prompt input inside the Rewrite submenu.
    const promptInput = page.getByRole('textbox', {name: 'Ask AI to edit message...'});
    await expect(promptInput).toBeVisible();
    await promptInput.focus();

    // # Type a phrase containing Korean Hangul using an IME that composes characters from multiple keypresses.
    await typeHangulWithIme(page, koreanTestPhrase);

    // * Verify the characters are correctly composed and were not dropped, doubled, or split into jamo.
    await expect(promptInput).toHaveValue(koreanTestPhrase);
});
