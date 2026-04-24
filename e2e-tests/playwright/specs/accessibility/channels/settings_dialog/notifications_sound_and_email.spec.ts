// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupAndOpenSettingsModal} from './support';

test(
    'accessibility scan and aria-snapshot of Desktop notification sounds section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Desktop notification sounds section
        await notificationsSettings.desktopNotificationSoundEditButton.click();

        // * Verify aria snapshot of Desktop notification sounds section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot({
            name: 'desktop_notification_sounds_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(notificationsSettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

test(
    'accessibility scan and aria-snapshot of Email notifications section',
    {tag: ['@accessibility', '@settings', '@notification_settings', '@snapshots']},
    async ({pw, axe}) => {
        const {page, settingsModal} = await setupAndOpenSettingsModal(pw);

        const notificationsSettings = settingsModal.notificationsSettings;

        // # Click Edit on Email notifications section
        await notificationsSettings.emailEditButton.click();

        // * Verify aria snapshot of Email notifications section when expanded
        await notificationsSettings.expandedSection.waitFor();
        await expect(notificationsSettings.expandedSection).toMatchAriaSnapshot({
            name: 'email_notifications_section.yml',
        });

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(notificationsSettings.expandedSectionId)
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
