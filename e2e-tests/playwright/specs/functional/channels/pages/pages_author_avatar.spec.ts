// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createDraftThroughUI,
    createTestChannel,
    createWikiThroughUI,
    ELEMENT_TIMEOUT,
    getEditor,
    getPageViewerContent,
    HIERARCHY_TIMEOUT,
    loginAndNavigateToChannel,
    publishPage,
    uniqueName,
} from './test_helpers';

/**
 * @objective Verify author avatar appears in wiki page draft editor
 */
test('displays author avatar and username in draft editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Avatar Wiki'));

    // # Create draft to see author avatar
    await createDraftThroughUI(page, 'Draft Page for Avatar');

    // * Verify author section is visible
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).toBeVisible();

    // * Verify author section has WikiPageEditor__author class
    await expect(authorSection).toHaveClass(/WikiPageEditor__author/);

    // * Verify username is displayed (user.username from sharedPagesSetup)
    const authorText = page.locator('.WikiPageEditor__authorText');
    await expect(authorText).toBeVisible();
    await expect(authorText).toContainText(`By ${user.username}`);

    // * Verify ProfilePicture component is rendered (has status-wrapper class)
    const profilePicture = authorSection.locator('.status-wrapper');
    await expect(profilePicture).toBeVisible();
});

/**
 * @objective Verify author avatar has proper accessibility attributes
 */
test('includes accessibility label for author section', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('A11y Wiki'));

    // # Create draft
    await createDraftThroughUI(page, 'Accessibility Test Page');

    // * Verify author section has aria-label
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).toBeVisible();

    const ariaLabel = await authorSection.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('Author:');
    expect(ariaLabel).toContain(user.username);
});

/**
 * @objective Verify author avatar displays correctly after page reload
 */
test('persists author avatar after page reload', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and draft
    await createWikiThroughUI(page, uniqueName('Persist Wiki'));
    await createDraftThroughUI(page, 'Persistence Test Page');

    // * Verify author avatar is visible before reload
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).toBeVisible();

    // # Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // # Wait for editor to reappear after reload
    const editor = getEditor(page);
    await editor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // * Verify author avatar is still visible after reload
    await expect(authorSection).toBeVisible();

    // * Verify username is still displayed correctly
    const authorText = page.locator('.WikiPageEditor__authorText');
    await expect(authorText).toBeVisible();
    await expect(authorText).toContainText(`By ${user.username}`);
});

/**
 * @objective Verify author section does not appear in published pages
 */
test('does not show author avatar in published page view', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and draft
    await createWikiThroughUI(page, uniqueName('Published Wiki'));
    await createDraftThroughUI(page, 'Page to Publish', 'Published content');

    // # Publish the page
    await publishPage(page);

    // # Wait for navigation to published page
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/[^/]+$/, {timeout: HIERARCHY_TIMEOUT});

    // * Verify author section is NOT visible in published view
    const authorSection = page.locator('[data-testid="wiki-page-author"]');
    await expect(authorSection).not.toBeVisible();

    // * Verify page content is visible (we're in view mode)
    const pageViewer = getPageViewerContent(page);
    await expect(pageViewer).toBeVisible();
});
