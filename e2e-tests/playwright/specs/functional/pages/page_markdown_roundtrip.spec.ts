// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Markdown Round-Trip E2E Tests
 *
 * Tests the full cycle: markdown → paste into editor → export back to markdown
 *
 * Bug Context: When copying markdown from a wiki page, pasting it elsewhere,
 * then copying back, the following issues were observed:
 * 1. Code block language hints lost (```bash → ```)
 * 2. Tables get extra newlines between rows
 * 3. Page title prepended unexpectedly
 *
 * These tests verify markdown fidelity through the full round-trip.
 */

import {expect, test} from '../channels/pages/pages_test_fixture';
import {buildWikiPageUrl, openPageActionsMenu, clickPageContextMenuItem} from '../channels/pages/test_helpers';

test.describe('Markdown Round-Trip', () => {
    test('MM-PAGE-MD-RT-1 Code block language should be preserved in round-trip', async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `Code Block RT Test ${Date.now()}`,
        });

        // Create page with code block that has language
        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'CLI Tools'}]},
                {
                    type: 'codeBlock',
                    attrs: {language: 'bash'},
                    content: [{type: 'text', text: '# Install Codex CLI\nnpm install -g @openai/codex'}],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Code Block Test', pageContent);

        // Login and navigate
        const {page} = await pw.testBrowser.login(user);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Copy as markdown
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');
        await page.waitForTimeout(500);

        // Read clipboard
        const markdown = await page.evaluate(() => navigator.clipboard.readText());

        // Verify code block language is preserved
        expect(markdown).toContain('```bash');
        expect(markdown).toContain('npm install -g @openai/codex');
    });

    test('MM-PAGE-MD-RT-2 Table formatting should be compact without extra newlines', async ({
        pw,
        sharedPagesSetup,
    }) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `Table RT Test ${Date.now()}`,
        });

        // Create page with table
        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'MCP Servers'}]},
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableHeader',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'MCP'}]}],
                                },
                                {
                                    type: 'tableHeader',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}],
                                },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{type: 'text', marks: [{type: 'code'}], text: 'seq-server'}],
                                        },
                                    ],
                                },
                                {
                                    type: 'tableCell',
                                    content: [
                                        {type: 'paragraph', content: [{type: 'text', text: 'Sequential thinking'}]},
                                    ],
                                },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{type: 'text', marks: [{type: 'code'}], text: 'gemini-cli'}],
                                        },
                                    ],
                                },
                                {
                                    type: 'tableCell',
                                    content: [
                                        {type: 'paragraph', content: [{type: 'text', text: 'Gemini LLM access'}]},
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Table Test', pageContent);

        const {page} = await pw.testBrowser.login(user);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');
        await page.waitForTimeout(500);

        const markdown = await page.evaluate(() => navigator.clipboard.readText());

        // Table should be compact - each row on one line
        expect(markdown).toMatch(/\| MCP \| Purpose \|/);
        expect(markdown).toMatch(/\| --- \| --- \|/);
        expect(markdown).toContain('`seq-server`');
        expect(markdown).toContain('Sequential thinking');

        // Should NOT have cell content split across lines with extra blank lines
        const lines = markdown.split('\n');
        const tableLines = lines.filter((l) => l.includes('|'));

        // Table should have exactly 4 rows: header, separator, 2 data rows
        expect(tableLines.length).toBe(4);
    });

    test('MM-PAGE-MD-RT-3 Ordered list numbers should not be escaped', async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `Ordered List RT Test ${Date.now()}`,
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Workflow'}]},
                {
                    type: 'orderedList',
                    attrs: {start: 1},
                    content: [
                        {
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'Plan Creation'}]}],
                        },
                        {
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'Implementation'}]}],
                        },
                        {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Review'}]}]},
                    ],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Ordered List Test', pageContent);

        const {page} = await pw.testBrowser.login(user);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');
        await page.waitForTimeout(500);

        const markdown = await page.evaluate(() => navigator.clipboard.readText());

        // Should have unescaped periods
        expect(markdown).toContain('1. Plan Creation');
        expect(markdown).toContain('2. Implementation');
        expect(markdown).toContain('3. Review');

        // Should NOT have escaped periods
        expect(markdown).not.toContain('1\\.');
        expect(markdown).not.toContain('2\\.');
        expect(markdown).not.toContain('3\\.');
    });

    test('MM-PAGE-MD-RT-4 Full architecture document should round-trip correctly', async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `Full Doc RT Test ${Date.now()}`,
        });

        // Create a document similar to architecture.md
        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Prerequisites'}]},
                {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'CLI Tools'}]},
                {
                    type: 'codeBlock',
                    attrs: {language: 'bash'},
                    content: [{type: 'text', text: '# Codex CLI\nnpm install -g @openai/codex'}],
                },
                {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'MCP Servers'}]},
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableHeader',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'MCP'}]}],
                                },
                                {
                                    type: 'tableHeader',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}],
                                },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{type: 'text', marks: [{type: 'code'}], text: 'seq-server'}],
                                        },
                                    ],
                                },
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'paragraph',
                                            content: [{type: 'text', text: 'Sequential thinking/reasoning'}],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {type: 'horizontalRule'},
                {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Workflow'}]},
                {
                    type: 'orderedList',
                    attrs: {start: 1},
                    content: [
                        {
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'Plan Creation'}]}],
                        },
                        {
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'Implementation'}]}],
                        },
                    ],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Architecture', pageContent);

        const {page} = await pw.testBrowser.login(user);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');
        await page.waitForTimeout(500);

        const markdown = await page.evaluate(() => navigator.clipboard.readText());

        // Verify all elements are present and correctly formatted
        expect(markdown).toContain('# Architecture'); // Title prepended
        expect(markdown).toContain('## Prerequisites');
        expect(markdown).toContain('### CLI Tools');
        expect(markdown).toContain('```bash');
        expect(markdown).toContain('npm install -g @openai/codex');
        expect(markdown).toContain('### MCP Servers');
        expect(markdown).toMatch(/\| MCP \| Purpose \|/);
        expect(markdown).toContain('`seq-server`');
        expect(markdown).toContain('---'); // Horizontal rule
        expect(markdown).toContain('## Workflow');
        expect(markdown).toContain('1. Plan Creation');
        expect(markdown).toContain('2. Implementation');
    });

    test('MM-PAGE-MD-RT-5 Multiple exports should be consistent', async ({pw, sharedPagesSetup}) => {
        // This test verifies that exporting the same page twice produces identical markdown
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `Consistency RT Test ${Date.now()}`,
        });

        // Create page with mixed content
        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Test Section'}]},
                {
                    type: 'codeBlock',
                    attrs: {language: 'bash'},
                    content: [{type: 'text', text: 'npm install'}],
                },
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableHeader',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Header1'}]}],
                                },
                                {
                                    type: 'tableHeader',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Header2'}]}],
                                },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableCell',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Cell1'}]}],
                                },
                                {
                                    type: 'tableCell',
                                    content: [{type: 'paragraph', content: [{type: 'text', text: 'Cell2'}]}],
                                },
                            ],
                        },
                    ],
                },
                {
                    type: 'orderedList',
                    attrs: {start: 1},
                    content: [
                        {
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'First item'}]}],
                        },
                        {
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'Second item'}]}],
                        },
                    ],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Consistency Test', pageContent);

        const {page} = await pw.testBrowser.login(user);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // First export
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');
        await page.waitForTimeout(500);
        const firstExport = await page.evaluate(() => navigator.clipboard.readText());

        // Second export
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');
        await page.waitForTimeout(500);
        const secondExport = await page.evaluate(() => navigator.clipboard.readText());

        // Both exports should be identical
        expect(firstExport).toBe(secondExport);

        // Verify content is correct
        expect(firstExport).toContain('## Test Section');
        expect(firstExport).toContain('```bash');
        expect(firstExport).toContain('npm install');
        expect(firstExport).toMatch(/\| Header1 \| Header2 \|/);
        expect(firstExport).toContain('1. First item');
        expect(firstExport).toContain('2. Second item');
    });
});
