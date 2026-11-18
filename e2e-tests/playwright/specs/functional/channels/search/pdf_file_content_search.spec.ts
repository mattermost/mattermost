// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * The word is drawn with the predefined CMap UniJIS-UCS2-H and no ToUnicode, so only
 * poppler (pdfinfo + pdftotext) with poppler-data cMap/cidToUnicode can extract it.
 * The pure-Go fallback yields NUL-interleaved bytes that never match the search.
 */
const pdfFile = 'pdf-cmap-canary.pdf';
const contentTerm = 'popplercmapcanary';

/**
 * @objective Verify the server image extracts PDF content with poppler so the file is found in Files search.
 *
 * @precondition
 * Server runs from the Docker image (server/build/Dockerfile), with FileSettings.ExtractContent
 * and ServiceSettings.EnableFileSearch at their default (enabled).
 */
test(
    'finds a PDF in Files search by text only poppler can extract',
    {tag: ['@search', '@file_attachments']},
    async ({pw}) => {
        const {user, team, adminClient} = await pw.initSetup();
        const isFips = (await adminClient.getClientConfig()).IsFipsEnabled === 'true';
        test.skip(isFips, 'The FIPS image (Dockerfile.fips) does not ship pdfinfo or poppler-data');

        // # Log in and post the PDF (message must not contain the search term)
        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();
        await channelsPage.postMessage(`pdf extract search ${pw.random.id()}`, [pdfFile]);

        // * Verify the PDF attachment is on the post
        const post = await channelsPage.getLastPost();
        await expect(post.container.getByText(pdfFile, {exact: true})).toBeVisible();

        // # Search until the files search returns the PDF (the upload may still be indexing)
        await expect
            .poll(
                async () => {
                    const filesSearch = page.waitForResponse(
                        (response) =>
                            response.url().includes('/files/search') && response.request().method() === 'POST',
                    );
                    await channelsPage.globalHeader.openSearch();
                    await channelsPage.searchBox.search(contentTerm);
                    const {file_infos: fileInfos = {}} = await (await filesSearch).json();
                    return Object.values<{name: string}>(fileInfos).some(({name}) => name === pdfFile);
                },
                {timeout: pw.duration.half_min},
            )
            .toBe(true);

        // * Verify the PDF is found by its extracted content
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.filesTab.click();
        await expect(channelsPage.searchResultsPanel.container.getByText(pdfFile, {exact: true})).toBeVisible();
    },
);
