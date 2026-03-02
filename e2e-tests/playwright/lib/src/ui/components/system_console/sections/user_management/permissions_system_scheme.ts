// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console -> User Management -> Permissions -> System Scheme (Edit Scheme).
 * Used to assert permission toggles (e.g. Manage Channel Auto Translation) per role section.
 */
export default class PermissionsSystemScheme {
    readonly container: Locator;

    readonly systemSchemeHeader: Locator;
    readonly channelAdministratorsSection: Locator;
    readonly teamAdministratorsSection: Locator;
    readonly systemAdministratorsSection: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.systemSchemeHeader = container.locator('.admin-console__header').getByText('System Scheme', {exact: true});
        this.channelAdministratorsSection = container
            .locator('.permissions-block')
            .filter({hasText: 'Channel Administrators'});
        this.teamAdministratorsSection = container
            .locator('.permissions-block')
            .filter({hasText: 'Team Administrators'});
        this.systemAdministratorsSection = container
            .locator('.permissions-block')
            .filter({hasText: 'System Administrators'});
    }

    async toBeVisible() {
        await expect(this.systemSchemeHeader).toBeVisible();
    }

    /**
     * Returns the permission row(s) for "Manage Channel Auto Translation" within the given section.
     * There can be two (public and private channel).
     */
    getManageChannelAutoTranslationRows(section: Locator): Locator {
        return section.locator('.permission-row').filter({hasText: 'Manage Channel Auto Translation'});
    }

    /**
     * Asserts that "Manage Channel Auto Translation" is checked (ON) in the given section.
     */
    async expectManageChannelAutoTranslationChecked(section: Locator) {
        const rows = this.getManageChannelAutoTranslationRows(section);
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(1);
        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            await expect(row.locator('.permission-check.checked')).toBeVisible();
        }
    }

    /**
     * Asserts that "Manage Channel Auto Translation" is not checked (OFF) in the given section.
     */
    async expectManageChannelAutoTranslationUnchecked(section: Locator) {
        const rows = this.getManageChannelAutoTranslationRows(section);
        const count = await rows.count();
        if (count === 0) {
            return;
        }
        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            await expect(row.locator('.permission-check.checked')).not.toBeVisible();
        }
    }
}
