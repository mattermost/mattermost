// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> User Management -> Permissions -> System Scheme (Edit Scheme).
 * Used to assert permission toggles (e.g. Manage Channel Auto Translation) per role section.
 */
export default class PermissionsSystemScheme extends BaseComponent {
    readonly systemSchemeHeader: Locator;
    readonly channelAdministratorsSection: Locator;
    readonly teamAdministratorsSection: Locator;
    readonly systemAdministratorsSection: Locator;

    constructor(container: Locator) {
        super(container);

        this.systemSchemeHeader = container
            .getByTestId('adminConsoleHeader')
            .getByText(en['admin.permissions.systemScheme'], {exact: true});
        this.channelAdministratorsSection = container.locator('#channelAdmins');
        this.teamAdministratorsSection = container.locator('#teamAdmins');
        this.systemAdministratorsSection = container.locator('#systemAdmins');
    }

    async toBeVisible() {
        await expect(this.systemSchemeHeader).toBeVisible();
    }

    /**
     * Returns the permission row(s) for "Manage Channel Auto Translation" within the given section.
     * There can be two (public and private channel).
     */
    getManageChannelAutoTranslationRows(section: Locator): Locator {
        return section.getByTestId('permissionRow').filter({hasText: 'Manage Channel Auto Translation'});
    }

    /**
     * Asserts that "Manage Channel Auto Translation" is checked (ON) in the given section.
     */
    async expectManageChannelAutoTranslationChecked(section: Locator) {
        const rows = this.getManageChannelAutoTranslationRows(section);
        const count = await rows.count();
        if (count === 0) {
            throw new Error(
                'Manage Channel Auto Translation permission rows not found in the section. ' +
                    'Expected to find at least one permission row to verify the checked state.',
            );
        }
        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            await expect(row.getByTestId('permissionCheck')).toHaveClass(/checked/);
        }
    }

    /**
     * Asserts that "Manage Channel Auto Translation" is not checked (OFF) in the given section.
     */
    async expectManageChannelAutoTranslationUnchecked(section: Locator) {
        const rows = this.getManageChannelAutoTranslationRows(section);
        const count = await rows.count();
        if (count === 0) {
            throw new Error(
                'Manage Channel Auto Translation permission rows not found in the section. ' +
                    'Expected to find at least one permission row to verify the unchecked state.',
            );
        }
        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            await expect(row.getByTestId('permissionCheck')).not.toHaveClass(/checked/);
        }
    }
}
