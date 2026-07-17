// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import SyncableConfiguration from './syncable_configuration';

import {duration} from '@/util';

/**
 * System Console -> User Management -> Team Configuration.
 */
export default class TeamConfiguration extends SyncableConfiguration {
    async goto(teamId: string) {
        await this.page.goto(`/admin_console/user_management/teams/${teamId}`);
        await expect(this.page.getByText('Team Configuration', {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }
}
