// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * docconv extracts .doc through wvText (a /bin/sh script calling wvWare) and ignores its
 * failure, so a broken extractor indexes the file as empty instead of erroring.
 */
const docFile = 'sample-doc.doc';
const contentTerm = 'simple';

/**
 * @objective Verify a legacy Word .doc attachment is content-extracted and found in Files search.
 *
 * @precondition
 * Server runs from the Docker image (server/build/Dockerfile), with FileSettings.ExtractContent
 * and ServiceSettings.EnableFileSearch at their default (enabled).
 */
test('finds a .doc in Files search by extracted content', {tag: ['@search', '@file_attachments']}, async ({pw}) => {
    // # Log in and post the .doc (message must not contain the search term)
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(`doc extract search ${pw.random.id()}`, [docFile]);

    // * Verify the .doc attachment is on the post
    const post = await channelsPage.getLastPost();
    await expect(post.container.getByText(docFile, {exact: true})).toBeVisible();

    // # Open Files search
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    await channelsPage.searchBox.filesButton.click();

    // * Verify the .doc is found by its extracted content
    await expect
        .poll(
            async () => {
                await channelsPage.searchBox.search(contentTerm);
                await channelsPage.searchResultsPanel.toBeVisible();
                await channelsPage.searchResultsPanel.filesTab.click();
                return channelsPage.searchResultsPanel.container.getByText(docFile, {exact: true}).isVisible();
            },
            {timeout: pw.duration.half_min},
        )
        .toBe(true);
});
