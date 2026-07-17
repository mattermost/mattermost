// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

export type GroupMentionPermissionId =
    | 'all_users-posts-use_group_mentions-checkbox'
    | 'channel_admin-posts-use_group_mentions-checkbox'
    | 'team_admin-posts-use_group_mentions-checkbox'
    | 'guests-guest_use_group_mentions-checkbox';

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

    async goto() {
        await this.container.page().goto('/admin_console/user_management/permissions/system_scheme');
        await expect(this.container.getByRole('heading', {name: 'All Members', exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async save() {
        const saveButton = this.container.getByRole('button', {name: 'Save', exact: true});
        await saveButton.click();
        await expect(saveButton).toBeDisabled({timeout: duration.half_min});
    }

    async reset() {
        await this.container.getByRole('button', {name: 'Reset to Defaults', exact: true}).click();
        await this.container.page().getByRole('dialog').getByRole('button', {name: 'Yes, Reset', exact: true}).click();
        await this.save();
    }

    async disableGroupMentions() {
        const checkbox = this.container.getByTestId('all_users-posts-use_group_mentions-checkbox');
        if ((await checkbox.getByTestId('permissionCheckbox-checked').count()) > 0) {
            await checkbox.click();
            await this.save();
        }
    }

    async setGroupMentionPermissions(permissions: Array<{id: GroupMentionPermissionId; enabled: boolean}>) {
        for (const permission of permissions) {
            const checkbox = this.container.getByTestId(permission.id);
            const isEnabled = (await checkbox.getByTestId('permissionCheckbox-checked').count()) > 0;
            if (isEnabled !== permission.enabled) {
                await checkbox.click();
            }
        }
        await this.save();
    }

    async expectGroupMentionPermissionsDisabled(
        ...permissionIds: Array<
            'all_users-posts-use_group_mentions-checkbox' | 'guests-guest_use_group_mentions-checkbox'
        >
    ) {
        for (const permissionId of permissionIds) {
            await expect(
                this.container.getByTestId(permissionId).getByTestId('permissionCheckbox-checked'),
            ).toHaveCount(0);
        }
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
}
