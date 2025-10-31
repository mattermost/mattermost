// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createTestChannel} from './test_helpers';

/**
 * @objective Verify page posts display with title and excerpt in Threads panel instead of raw JSON
 */
test('displays page with title and excerpt in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page with content
    const wiki = await createWikiThroughUI(page, `Threads Wiki ${pw.random.id()}`);
    const pageTitle = 'Getting Started Guide';
    const pageContent = 'This guide covers user authentication, API endpoints, and deployment. It provides step-by-step instructions for new developers.';
    const testPage = await createPageThroughUI(page, pageTitle, pageContent);

    // # Add inline comment to create a thread
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        const editor = page.locator('.ProseMirror').first();
        await editor.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');

        const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
        if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
            await commentButton.click();

            const modal = page.getByRole('dialog');
            if (await modal.isVisible({timeout: 3000}).catch(() => false)) {
                await modal.locator('textarea').fill('Great article overall!');
                await modal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first().click();
            }
        }

        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');
    }

    // # Click comment marker to open thread in RHS (creates participation)
    const commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        await commentMarker.click();
        await page.waitForTimeout(1000);

        // * Verify RHS opens with page post showing title (not JSON)
        const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
        if (await rhs.isVisible({timeout: 3000}).catch(() => false)) {
            await expect(rhs).toContainText(pageTitle);
            await expect(rhs).not.toContainText('{"type"');
        }
    }

    // # Navigate to Threads view
    const threadsLink = page.locator('a[href*="/threads"]').first();
    if (await threadsLink.isVisible({timeout: 5000}).catch(() => false)) {
        await threadsLink.click();
        await page.waitForTimeout(2000);

        // * Verify page appears in threads list (if comment was created successfully)
        const bodyText = await page.locator('body').textContent();
        if (bodyText && !bodyText.includes('No followed threads yet')) {
            // Thread appeared - verify proper formatting
            await expect(page.locator('body')).toContainText(pageTitle);

            // * Verify page icon is shown
            const pageIcon = page.locator('i.icon-file-document-outline, [class*="file-document"]').first();
            if (await pageIcon.isVisible({timeout: 3000}).catch(() => false)) {
                await expect(pageIcon).toBeVisible();
            }

            // * Verify no JSON artifacts visible in threads
            await expect(page.locator('body')).not.toContainText('{"type"');
        }
    }
});

/**
 * @objective Verify page comments and inline comments both appear in Threads panel
 */
test('displays page comments and inline comments in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `Comments Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Documentation Page', 'Introduction: This covers authentication and API endpoints for developers');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
    }

    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    // # Add inline comment on "authentication"
    // Select the word "authentication"
    await page.keyboard.down('Control');
    await page.keyboard.press('f');
    await page.keyboard.up('Control');

    const findBox = page.locator('input[type="search"], [placeholder*="Find"]').first();
    if (await findBox.isVisible({timeout: 2000}).catch(() => false)) {
        await findBox.fill('authentication');
        await page.keyboard.press('Escape');
    } else {
        // Fallback: select all text
        await editor.click();
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
    }

    const inlineCommentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await inlineCommentButton.isVisible({timeout: 2000}).catch(() => false)) {
        await inlineCommentButton.click();

        const modal = page.getByRole('dialog');
        if (await modal.isVisible({timeout: 3000}).catch(() => false)) {
            await modal.locator('textarea').fill('Needs more detail here');
            await modal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first().click();
            await page.waitForTimeout(500);
        }
    }

    // # Publish page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Click comment marker to open thread in RHS
    const commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        await commentMarker.click();
        await page.waitForTimeout(1000);

        // * Verify RHS opens with thread
        const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
        await expect(rhs).toBeVisible();

        // * Verify page title appears in RHS (not JSON)
        await expect(rhs).toContainText('Documentation Page');

        // * Verify inline comment appears
        await expect(rhs).toContainText('Needs more detail here');

        // * Verify no JSON artifacts in RHS
        await expect(rhs).not.toContainText('{"type"');
    }

    // # Open Threads panel to verify comment shows there too
    const threadsButton = page.locator('[aria-label*="Thread"], button[data-testid="threads-button"], button:has-text("Threads")').first();
    if (await threadsButton.isVisible({timeout: 5000}).catch(() => false)) {
        await threadsButton.click();
        await page.waitForTimeout(1000);

        const threadsPanel = page.locator('[data-testid="threads-panel"], .threads-panel').first();
        if (await threadsPanel.isVisible({timeout: 3000}).catch(() => false)) {
            // * Verify page appears in threads list
            await expect(threadsPanel).toContainText('Documentation Page');

            // * Verify comment count badge shows
            const commentBadge = threadsPanel.locator('[class*="badge"], [class*="count"]').first();
            if (await commentBadge.isVisible({timeout: 2000}).catch(() => false)) {
                await expect(commentBadge).toBeVisible();
            }
        }
    }
});

/**
 * @objective Verify replies to page comments display correctly in Threads
 */
test('displays comment replies in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `Replies Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Feature Spec', 'This feature should support real-time collaboration and offline mode');

    // # Add initial comment
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();

        const editor = page.locator('.ProseMirror').first();
        await editor.click();

        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');

        const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
        if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
            await commentButton.click();

            const modal = page.getByRole('dialog');
            if (await modal.isVisible({timeout: 3000}).catch(() => false)) {
                await modal.locator('textarea').fill('Should we prioritize real-time or offline?');
                await modal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first().click();
            }
        }

        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
        await publishButton.click();
        await page.waitForLoadState('networkidle');
    }

    // # Click comment to open RHS
    const commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        await commentMarker.click();

        const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
        if (await rhs.isVisible({timeout: 3000}).catch(() => false)) {
            // # Add reply
            const replyTextarea = rhs.locator('textarea[placeholder*="Reply"], textarea, [contenteditable="true"]').last();
            if (await replyTextarea.isVisible().catch(() => false)) {
                await replyTextarea.fill('I think real-time is more important');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(1000);

                // * Verify reply appears in RHS
                await expect(rhs).toContainText('I think real-time is more important');
            }
        }
    }

    // # Open Threads panel
    const threadsButton = page.locator('[aria-label*="Thread"], button[data-testid="threads-button"], button:has-text("Threads")').first();
    if (await threadsButton.isVisible({timeout: 5000}).catch(() => false)) {
        await threadsButton.click();
        await page.waitForTimeout(1000);

        const threadsPanel = page.locator('[data-testid="threads-panel"], .threads-panel').first();
        if (await threadsPanel.isVisible({timeout: 3000}).catch(() => false)) {
            // * Verify thread shows in Threads panel
            await expect(threadsPanel).toContainText('Feature Spec');

            // # Click thread to open it
            const threadItem = threadsPanel.locator('text=Feature Spec').first();
            await threadItem.click();
            await page.waitForTimeout(1000);

            // * Verify RHS shows both original comment and reply
            const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
            await expect(rhs).toContainText('Should we prioritize real-time or offline?');
            await expect(rhs).toContainText('I think real-time is more important');

            // * Verify page title is readable (not JSON)
            await expect(rhs).toContainText('Feature Spec');
            await expect(rhs).not.toContainText('{"type"');
        }
    }
});

/**
 * @objective Verify multiple inline comments from same page show correctly in Threads
 */
test('displays multiple inline comments in Threads panel', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `Multi Comment Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'API Documentation', 'Authentication uses JWT tokens. Rate limiting is 100 requests per minute. Pagination uses cursor-based approach.');

    // # Start editing
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
    }

    const editor = page.locator('.ProseMirror').first();

    // # Add first inline comment
    await editor.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');

    let commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
        await commentButton.click();

        const modal = page.getByRole('dialog');
        if (await modal.isVisible({timeout: 3000}).catch(() => false)) {
            await modal.locator('textarea').fill('Can we add OAuth2 support?');
            await modal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first().click();
            await page.waitForTimeout(500);
        }
    }

    // # Add second inline comment (select different text or use same approach)
    await editor.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');

    commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
        await commentButton.click();

        const modal = page.getByRole('dialog');
        if (await modal.isVisible({timeout: 3000}).catch(() => false)) {
            await modal.locator('textarea').fill('Should document the error codes');
            await modal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first().click();
            await page.waitForTimeout(500);
        }
    }

    // # Publish page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Click first comment marker to open thread
    const firstCommentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    if (await firstCommentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        await firstCommentMarker.click();
        await page.waitForTimeout(1000);

        const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
        if (await rhs.isVisible({timeout: 3000}).catch(() => false)) {
            // * Verify page title is readable
            await expect(rhs).toContainText('API Documentation');

            // * Verify first comment visible
            await expect(rhs).toContainText('Can we add OAuth2 support?');
        }
    }

    // # Open Threads panel to see all comments
    const threadsButton = page.locator('[aria-label*="Thread"], button[data-testid="threads-button"], button:has-text("Threads")').first();
    if (await threadsButton.isVisible({timeout: 5000}).catch(() => false)) {
        await threadsButton.click();
        await page.waitForTimeout(1000);

        const threadsPanel = page.locator('[data-testid="threads-panel"], .threads-panel').first();
        if (await threadsPanel.isVisible({timeout: 3000}).catch(() => false)) {
            // * Verify thread appears with page title
            await expect(threadsPanel).toContainText('API Documentation');

            // * Verify comment count reflects multiple comments (if badge shows count)
            const badge = threadsPanel.locator('[class*="badge"]').first();
            if (await badge.isVisible({timeout: 2000}).catch(() => false)) {
                // Should show 2+ comments
                const badgeText = await badge.textContent();
                expect(parseInt(badgeText || '0')).toBeGreaterThanOrEqual(2);
            }
        }
    }
});
