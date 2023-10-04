// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import {getRandomId} from '@e2e-support/util';
import {expect} from '@playwright/test';

const keywords = [
    `AB${getRandomId()}`,
    `CD${getRandomId()}`,
    `EF${getRandomId()}`,
    `test message ${getRandomId()}`,
];

test('MM-XX Should add the keyword when enter, comma or tab is pressed on the textbox', async ({
    pw,
    pages,
}) => {
    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    await channelPage.centerView.postCreate.postMessage('Hello World');

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.accountSettingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.accountSettingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.accountSettingsModal.notificationsSettings.openSectionKeywordsThatGetsHighlighted();
    
    const keywordsInput = await channelPage.accountSettingsModal.notificationsSettings.getKeywordsInput()
    
    // # Enter keyword 1
    await keywordsInput.type(keywords[0]);

    // # Press Comma on the textbox
    await keywordsInput.press(',');

    // # Enter keyword 2
    await keywordsInput.type(keywords[1]);

    // # Press Tab on the textbox
    await keywordsInput.press('Tab');

    // # Enter keyword 3
    await keywordsInput.type(keywords[2]);

    // # Press Enter on the textbox
    await keywordsInput.press('Enter');

    // * Verify that the keywords are added is collapsed description
    await expect(channelPage.accountSettingsModal.notificationsSettings.container.getByText(keywords[0])).toBeVisible();
    await expect(channelPage.accountSettingsModal.notificationsSettings.container.getByText(keywords[1])).toBeVisible();
    await expect(channelPage.accountSettingsModal.notificationsSettings.container.getByText(keywords[2])).toBeVisible();
});

test('MM-XX Should highlight the keywords when a message is sent with the keyword', async ({
    pw,
    pages,
}) => {
    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Post a message without the keyword
    await channelPage.centerView.postCreate.postMessage('test test test');

    // # Post a message with the keyword
    await channelPage.centerView.postCreate.postMessage(`This message contains the keyword ${keywords[3]}`);

    // # Open settings modal
    await channelPage.globalHeader.openSettings();
    await channelPage.accountSettingsModal.toBeVisible();

    // # Open notifications tab
    await channelPage.accountSettingsModal.openNotificationsTab();

    // # Open keywords that get highlighted section
    await channelPage.accountSettingsModal.notificationsSettings.openSectionKeywordsThatGetsHighlighted();

    // # Enter the keyword
    (await channelPage.accountSettingsModal.notificationsSettings.getKeywordsInput()).type(keywords[3]);

    // # Save the settings
    await channelPage.accountSettingsModal.notificationsSettings.clickOnSaveSection();

    // # Close the settings modal
    await channelPage.accountSettingsModal.closeModal();
});