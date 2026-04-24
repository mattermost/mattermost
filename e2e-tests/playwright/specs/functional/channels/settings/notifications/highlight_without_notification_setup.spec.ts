// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {generateKeywords} from './support';

let keywords: string[];

test.beforeEach(async ({pw}) => {
    keywords = generateKeywords(pw);
});

test('MM-T5465-1 Should add the keyword when enter, comma or tab is pressed on the textbox', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.postMessage('Hello World');

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // # Open notifications tab
    const notificationsSettings = await settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await notificationsSettings.expandSection('keysWithHighlight');

    const keywordsInput = await notificationsSettings.getKeywordsInput();

    // # Enter keyword 1
    await keywordsInput.fill(keywords[0]);

    // # Press Comma on the textbox
    await keywordsInput.press(',');

    // # Enter keyword 2
    await keywordsInput.fill(keywords[1]);

    // # Press Tab on the textbox
    await keywordsInput.press('Tab');

    // # Enter keyword 3
    await keywordsInput.fill(keywords[2]);

    // # Press Enter on the textbox
    await keywordsInput.press('Enter');

    // * Verify that the keywords have been added to the collapsed description
    const keysWithHighlightDesc = notificationsSettings.keysWithHighlightDesc;
    await keysWithHighlightDesc.waitFor();
    for (const keyword of keywords.slice(0, 3)) {
        expect(await keysWithHighlightDesc).toContainText(keyword);
    }
});

test('MM-T5465-4 Highlighted keywords should not appear in the Recent Mentions', async ({pw}) => {
    // # Skip test if no license
    await pw.skipIfNoLicense();

    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open settings modal
    const settingsModal = await channelsPage.globalHeader.openSettings();

    // # Open notifications tab
    const notificationsSettings = await settingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await notificationsSettings.expandSection('keysWithHighlight');

    // # Enter the keyword
    const keywordsInput = await notificationsSettings.getKeywordsInput();
    await keywordsInput.fill(keywords[0]);
    await keywordsInput.press('Tab');

    // # Save the keyword
    await notificationsSettings.save();

    // # Close the settings modal
    await settingsModal.close();

    // # Open the recent mentions
    await channelsPage.globalHeader.openRecentMentions();

    // * Verify recent mentions is empty
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.sidebarRight.container.getByText('No mentions yet')).toBeVisible();
});
