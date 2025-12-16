// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    createTestChannel,
    getBreadcrumb,
} from './test_helpers';

/**
 * @objective Verify that parent page content renders correctly after navigating back from a child page via breadcrumb
 *
 * @precondition
 * This test verifies the TipTap editor rendering behavior during breadcrumb navigation
 */
test(
    'parent page content renders after breadcrumb navigation from child page',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki and parent page
        await createWikiThroughUI(page, `Test Wiki ${await pw.random.id()}`);
        const parentPage = await createPageThroughUI(page, 'Parent Page', 'Parent content');

        // * Verify parent page is currently displayed with content
        const pageViewerContent = page.locator('[data-testid="page-viewer-content"]');
        await expect(pageViewerContent).toContainText('Parent content');

        // # Create child page - this navigates away from parent
        await createChildPageThroughContextMenu(page, parentPage.id!, 'Child Page', 'Child content');

        // * Verify we're now on child page
        await expect(pageViewerContent).toContainText('Child content');

        // # Click breadcrumb to go back to parent
        const breadcrumb = getBreadcrumb(page);
        const parentLink = breadcrumb.getByRole('link', {name: 'Parent Page'});
        await parentLink.click();
        await page.waitForLoadState('networkidle');

        // * Verify parent page content renders correctly
        await expect(pageViewerContent).toContainText('Parent content');
    },
);
