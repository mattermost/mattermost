// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const pdfFile = 'sample-doc.pdf';
/** Term that appears in sample-doc.pdf body text, not in the post message. */
const contentTerm = 'simple';

/**
 * @objective Verify a PDF attachment is content-extracted and appears in Files search for text inside the PDF.
 *
 * @precondition
 * FileSettings.ExtractContent and ServiceSettings.EnableFileSearch are enabled (Playwright defaults).
 * Asset sample-doc.pdf under e2e-tests/playwright/asset/ (same content as server/tests/sample-doc.pdf).
 */
test(
    'finds a PDF in Files search by extracted content',
    {tag: ['@search', '@file_attachments']},
    async ({pw}) => {
        // # Create user with extraction and file search enabled
        const {user, team, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({
            ServiceSettings: {EnableFileSearch: true},
            FileSettings: {ExtractContent: true},
        });

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        // # Upload and post the PDF (message must not contain the search term)
        await channelsPage.postMessage(`pdf extract search ${pw.random.id()}`, [pdfFile]);

        // * Verify the PDF attachment is on the post
        const post = await channelsPage.getLastPost();
        await expect(post.container.getByText(pdfFile, {exact: true})).toBeVisible();

        // # Open Files search for a term that exists only inside the PDF body
        await channelsPage.globalHeader.openSearch();
        await channelsPage.searchBox.toBeVisible();
        await channelsPage.searchBox.filesButton.click();

        // * Poll until extraction finishes and the file appears in Files results
        await expect
            .poll(
                async () => {
                    await channelsPage.searchBox.search(contentTerm);
                    await channelsPage.searchResultsPanel.toBeVisible();
                    await channelsPage.searchResultsPanel.filesTab.click();
                    return channelsPage.searchResultsPanel.container.getByText(pdfFile, {exact: true}).isVisible();
                },
                {timeout: pw.duration.half_min},
            )
            .toBe(true);
    },
);
