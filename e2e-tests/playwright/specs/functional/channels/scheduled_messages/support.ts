// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, ScheduledPostIndicator} from '@mattermost/playwright-lib';
import type {ChannelsPage, ScheduledPostsPage} from '@mattermost/playwright-lib';

/**
 * Verifies that the scheduled post indicator shows the correct date and time.
 */
export async function verifyScheduledPostIndicator(
    scheduledPostIndicator: ScheduledPostIndicator,
    selectedDate: string,
    selectedTime: string | null,
) {
    await scheduledPostIndicator.toBeVisible();
    await expect(scheduledPostIndicator.icon).toBeVisible();

    if (!selectedTime) {
        throw new Error('selectedTime is required');
    }

    // Verify the indicator contains both the time and a valid date
    const messageText = await scheduledPostIndicator.messageText.textContent();
    await expect(scheduledPostIndicator.messageText).toContainText(selectedTime);
    const datePatterns = [
        selectedDate, // Original date
        'Today',
        'Tomorrow',
    ];

    const hasValidDate = datePatterns.some((pattern) => messageText?.toLowerCase().includes(pattern.toLowerCase()));

    if (!hasValidDate) {
        throw new Error(
            `Indicator text "${messageText}" does not contain any expected date pattern: ${datePatterns.join(', ')}`,
        );
    }
}

export async function verifyScheduledPostBadgeOnLeftSidebar(channelsPage: ChannelsPage, count: number) {
    await channelsPage.sidebarLeft.scheduledPostBadge.isVisible();
    await expect(channelsPage.sidebarLeft.scheduledPostBadge).toHaveText(count.toString());
}

export async function verifyScheduledPost(
    scheduledPostsPage: ScheduledPostsPage,
    {
        draftMessage,
        selectedDate,
        selectedTime,
        badgeCountOnTab,
    }: {draftMessage: string; selectedDate: string; selectedTime: string | null; badgeCountOnTab: number},
) {
    // * Verify scheduled posts page is visible
    await scheduledPostsPage.toBeVisible();

    // * Verify scheduled post badge on tab has correct count
    expect(await scheduledPostsPage.getBadgeCountOnTab()).toBe(badgeCountOnTab.toString());

    // * Verify scheduled post appears in scheduled posts page
    const scheduledPost = await scheduledPostsPage.getLastPost();
    await expect(scheduledPost.panelBody).toContainText(draftMessage);

    if (!selectedTime) {
        throw new Error('selectedTime is required');
    }

    // Verify the header contains both the time and a valid date
    const headerText = await scheduledPost.panelHeader.textContent();
    await expect(scheduledPost.panelHeader).toContainText(selectedTime);
    const datePatterns = [
        selectedDate, // Original date
        'Today',
        'Tomorrow',
    ];

    const hasValidDate = datePatterns.some((pattern) => headerText?.toLowerCase().includes(pattern.toLowerCase()));

    if (!hasValidDate) {
        throw new Error(
            `Header "${headerText}" does not contain any expected date pattern: ${datePatterns.join(', ')}`,
        );
    }

    return scheduledPost;
}
