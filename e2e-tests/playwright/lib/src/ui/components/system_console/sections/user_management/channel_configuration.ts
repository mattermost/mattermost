// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import SyncableConfiguration from './syncable_configuration';

import {duration} from '@/util';

/**
 * System Console -> User Management -> Channel Configuration.
 */
export default class ChannelConfiguration extends SyncableConfiguration {
    async goto(channelId: string) {
        await this.page.goto(`/admin_console/user_management/channels/${channelId}`);
        await expect(this.page.getByText('Channel Configuration', {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async setPublic(isPublic: boolean) {
        const expectedMode = isPublic ? 'Public' : 'Private';
        const currentMode = isPublic ? 'Private' : 'Public';
        const currentModeButton = this.page.getByRole('button', {name: currentMode, exact: true});
        if (await currentModeButton.isVisible().catch(() => false)) {
            await currentModeButton.click();
        }
        await expect(this.page.getByRole('button', {name: expectedMode, exact: true})).toBeVisible();
    }

    async toggleSyncGroupMembers() {
        await this.page.getByTestId('syncGroupSwitch-button').click();
    }

    async expectMode(mode: 'Public' | 'Private') {
        await expect(this.page.getByRole('button', {name: mode, exact: true})).toBeVisible();
    }

    async expectDefaultChannelTogglesToBeDisabled() {
        await expect(this.page.getByTestId('syncGroupSwitch-button')).toBeDisabled();
        await expect(this.page.getByRole('button', {name: 'Public', exact: true})).toBeDisabled();
    }
}
