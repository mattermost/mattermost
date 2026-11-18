// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {App, expect, formatMessage, Msg, test} from '@mattermost/playwright-lib';

/** Clicks the search panel's popout button and returns the popout window's app, once its document has loaded. */
async function openPopout(app: App) {
    const [popoutPage] = await Promise.all([app.page.waitForEvent('popup'), app.search.header.popoutButton.click()]);
    await popoutPage.waitForLoadState('domcontentloaded');
    return new App(popoutPage);
}

/** Searches for the term from the global header. */
async function searchFor(app: App, term: string) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(term);
    await app.searchBox.inputSearchbox.press('Enter');
    await expect(app.globalHeader.search.openButton).toContainText(term);
}

test('MM-65630-1 Search results should show popout button that opens results in a new window', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Search Popout Channel',
            name: 'search-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);
    const uniqueText = `popout-search-test-${pw.random.id()}`;
    const post = await adminClient.createPost({channel_id: channel.id, message: uniqueText});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    await searchFor(app, uniqueText);
    await expect(app.search.results.post(post).message.container).toHaveText(uniqueText);

    await expect(app.search.header.popoutButton).toBeVisible();
    const popout = await openPopout(app);

    const popoutUrl = popout.page.url();
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
    expect(popoutUrl).toContain(`q=${encodeURIComponent(uniqueText)}`);
    expect(popoutUrl).toContain('mode=search');

    await expect(popout.search.results.post(post).message.container).toHaveText(uniqueText);

    await popout.page.close();
});

test('MM-65630-2 Recent mentions popout should open with the right results', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Mentions Popout Channel',
            name: 'mentions-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);
    const mentionText = `hey @${user.username} check this mention-${pw.random.id()}`;
    const post = await adminClient.createPost({channel_id: channel.id, message: mentionText});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    await app.globalHeader.recentMentionsButton.click();
    await expect(app.search.header).toBeVisible();
    await expect(app.search.header).toContainText(formatMessage(Msg.search_header.title2));
    await expect(app.search.results.post(post).message.container).toBeVisible();
    await expect(app.search.results.post(post).message.container).toContainText(mentionText);

    await expect(app.search.header.popoutButton).toBeVisible();
    const popout = await openPopout(app);

    const popoutUrl = popout.page.url();
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
    expect(popoutUrl).toContain('mode=mention');

    await expect(popout.search.results.post(post).message.container).toBeVisible();
    await expect(popout.search.results.post(post).message.container).toContainText(mentionText);

    await popout.page.close();
});

test('MM-65630-3 Saved messages popout should open with the right results', async ({pw}) => {
    const {adminClient, user, userClient, team} = await pw.initSetup();
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Saved Popout Channel',
            name: 'saved-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);
    const savedText = `saved-message-test-${pw.random.id()}`;
    const post = await adminClient.createPost({channel_id: channel.id, message: savedText});
    await userClient.savePreferences(user.id, [
        {
            user_id: user.id,
            category: 'flagged_post',
            name: post.id,
            value: 'true',
        },
    ]);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    await app.globalHeader.savedMessagesButton.click();
    await expect(app.search.header).toBeVisible();
    await expect(app.search.header).toContainText(formatMessage(Msg.search_header.title3));
    await expect(app.search.results.post(post).message.container).toHaveText(savedText);

    await expect(app.search.header.popoutButton).toBeVisible();
    const popout = await openPopout(app);

    const popoutUrl = popout.page.url();
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
    expect(popoutUrl).toContain('mode=flag');

    await expect(popout.search.results.post(post).message.container).toHaveText(savedText);

    await popout.page.close();
});

test('MM-65630-4 Search popout should not show popout button in the popout window itself', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Popout No Button Channel',
            name: 'popout-no-button-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);
    const uniqueText = `no-button-test-${pw.random.id()}`;
    const post = await adminClient.createPost({channel_id: channel.id, message: uniqueText});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    await searchFor(app, uniqueText);
    await expect(app.search.results.post(post).message.container).toHaveText(uniqueText);

    // (the main window's panel has both buttons: the checks below can't pass on ids that never render)
    await expect(app.search.header.closeButton).toBeVisible();
    const popout = await openPopout(app);

    await expect(popout.search.results.post(post).message.container).toHaveText(uniqueText);
    await expect(popout.search.header.popoutButton).not.toBeVisible();
    await expect(popout.search.header.closeButton).not.toBeVisible();

    await popout.page.close();
});

test('MM-65630-5 Search popout should preserve search type (files) in the URL', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Files Search Channel',
            name: 'files-search-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    await searchFor(app, 'test');
    await app.search.tabs.filesTab.select();

    await expect(app.search.header.popoutButton).toBeVisible();
    const popout = await openPopout(app);

    expect(popout.page.url()).toContain('type=files');

    await popout.page.close();
});
