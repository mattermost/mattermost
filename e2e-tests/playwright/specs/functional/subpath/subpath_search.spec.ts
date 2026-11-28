// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

test.describe('Subpath - search', {tag: '@subpath'}, () => {
    let subpathBaseURL: string;

    test.beforeAll(() => {
        subpathBaseURL = requireSubpathServer();
    });

    /**
     * @objective Verify a search result jump navigates to the target channel under the subpath.
     */
    test('jumps from a search result to the target channel under the subpath', async ({pw}) => {
        const {user, team, adminClient} = await pw.initSetup();
        const targetChannel = await adminClient.createPublicChannel(team.id, 'Subpath Search Target');
        await adminClient.addToChannel(user.id, targetChannel.id);

        const token = `subpathsearch${pw.random.id()}`;
        const post = await adminClient.createPost({channel_id: targetChannel.id, message: token});

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});

        // # Search for the message and jump to it
        await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
        await app.searchBox.inputSearchbox.fill(token);
        await app.searchBox.inputSearchbox.press('Enter');
        const result = app.search.results.post(post);
        await expect(result.message.container).toContainText(token);
        await result.container.hover();
        await result.menu.jumpLink.click();

        // * Verify navigation lands on the target channel under the subpath
        await expect
            .poll(() => page.url(), {timeout: pw.duration.ten_sec})
            .toContain(`${subpathBaseURL}/${team.name}/channels/${targetChannel.name}`);
    });
});
