// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

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

        this.systemSchemeHeader = container.getByText('System Scheme', {exact: true});
        this.channelAdministratorsSection = container.locator('#channelAdministratorsSection');
        this.teamAdministratorsSection = container.locator('#teamAdministratorsSection');
        this.systemAdministratorsSection = container.locator('#systemAdministratorsSection');
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
            await expect(row.getByTestId('permissionCheckbox-checked')).toBeVisible();
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
            await expect(row.getByTestId('permissionCheckbox-checked')).not.toBeVisible();
        }
    }

    /**
     * The checkbox for one Docs space permission in a role's tree. Permission rows compose their
     * test id from the role name down through the enclosing group, so the space rows live under
     * the `spaces` group this epic adds — e.g. `all_users-spaces-create_space-checkbox`.
     */
    getSpacePermissionCheckbox(roleName: string, permission: string): Locator {
        return this.container.getByTestId(`${roleName}-spaces-${permission}-checkbox`);
    }

    /**
     * Asserts the Spaces group renders every team-scoped space permission for the given role.
     * Rendering is what makes them administrable at all; whether each is checked is the scheme's
     * current state, which the caller asserts separately.
     */
    async toHaveSpacePermissionRows(roleName: string) {
        for (const permission of ['read_space', 'create_space', 'manage_space', 'delete_space']) {
            await expect(this.getSpacePermissionCheckbox(roleName, permission)).toBeVisible();
        }
    }

    /**
     * A permission checkbox by its full test id, e.g. `all_users-posts-use_channel_mentions-checkbox`.
     * Clicking one toggles it and enables Save, which stays enabled even if the toggle is reverted:
     * the editor latches "unsaved changes" on any interaction rather than diffing.
     */
    getPermissionCheckbox(testId: string): Locator {
        return this.container.getByTestId(testId);
    }

    /**
     * Saves the scheme and waits for the save to settle. The button is disabled until the form is
     * dirty, so it is asserted enabled first: without an edit the click would otherwise wait out
     * its timeout on a permanently disabled button, and the settle assertion below would pass on
     * the initial state rather than on a completed save. The button re-enables only once the role
     * writes have come back, so waiting on it is what makes a later API read see the result.
     */
    async save() {
        const saveButton = this.container.page().getByTestId('saveSetting');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await expect(saveButton).toBeDisabled();
    }
}
