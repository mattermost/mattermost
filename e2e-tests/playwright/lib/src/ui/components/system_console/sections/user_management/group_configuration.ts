// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

type MembershipRole = 'Member' | 'Team Admin' | 'Channel Admin';

/**
 * System Console -> User Management -> AD/LDAP Group Configuration.
 */
export default class GroupConfiguration {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto(groupId: string, memberEmail?: string) {
        await this.page.goto(`/admin_console/user_management/groups/${groupId}`);
        await expect(this.page.getByText('Group Profile', {exact: true})).toBeVisible({timeout: duration.half_min});
        if (memberEmail) {
            await expect(this.page.getByText(memberEmail, {exact: true})).toBeVisible({timeout: duration.half_min});
        }
    }

    async gotoInvalid(groupId: string) {
        await this.page.goto(`/admin_console/user_management/groups/${groupId}`);
        await expect(this.page.getByText('AD/LDAP Groups', {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async save() {
        await this.page.getByRole('button', {name: 'Save', exact: true}).click();
    }

    async setMention(enabled: boolean, mentionName?: string) {
        const toggle = this.page.getByTestId('allowReferenceSwitch-button');
        const isEnabled = (await toggle.getAttribute('aria-pressed')) === 'true';
        if (isEnabled !== enabled) {
            await toggle.click();
        }
        if (enabled && mentionName) {
            await this.page.getByLabel('Group Mention:', {exact: true}).fill(mentionName);
        }
        const saveButton = this.page.getByRole('button', {name: 'Save', exact: true});
        if (await saveButton.isEnabled()) {
            await saveButton.click();
            await expect(saveButton).toBeDisabled({timeout: duration.half_min});
        }
    }

    async addTeamOrChannel(kind: 'Team' | 'Channel', displayName: string) {
        await this.page.getByRole('button', {name: /^Add Team or Channel/}).click();
        await this.page.getByRole('menuitem', {name: `Add ${kind}`, exact: true}).click();
        const dialog = this.page.getByRole('dialog').last();
        await expect(dialog).toBeVisible({timeout: duration.half_min});
        const searchInput = dialog.getByRole('combobox', {
            name: `Search and add ${kind.toLowerCase()}s`,
            exact: true,
        });
        await searchInput.fill(displayName);
        await expect(dialog.getByRole('status')).toContainText('1 result');
        await searchInput.press('ArrowDown');
        await searchInput.press('Enter');
        await dialog.getByRole('button', {name: 'Add', exact: true}).click();
        await expect(this.page.getByText(displayName, {exact: true}).first()).toBeVisible();
    }

    async expectNoTeamOrChannelMemberships() {
        await expect(this.page.getByText('No teams or channels specified yet', {exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async expectTeamOrChannelMembership(displayName: string, visible = true) {
        const membership = this.page.getByText(displayName, {exact: true}).first();
        if (visible) {
            await expect(membership).toBeVisible({timeout: duration.half_min});
        } else {
            await expect(membership).toHaveCount(0);
        }
    }

    async removeTeamOrChannel(displayName: string) {
        await this.requestRemoveTeamOrChannel(displayName);
        await this.confirmRemoveTeamOrChannel();
    }

    async requestRemoveTeamOrChannel(displayName: string) {
        const row = this.page
            .getByRole('row')
            .filter({has: this.page.getByText(displayName, {exact: true})})
            .filter({has: this.page.getByText(/^(Member|Team Admin|Channel Admin)$/)});
        await row.getByRole('button', {name: 'Remove', exact: true}).click();
    }

    async confirmRemoveTeamOrChannel() {
        await this.page.getByRole('dialog').getByRole('button', {name: 'Yes, Remove', exact: true}).click();
    }

    async changeMembershipRole(displayName: string, currentRole: MembershipRole, newRole: MembershipRole) {
        const roleControl = this.page.getByTestId(`${displayName}_current_role`);
        await expect(roleControl).toHaveText(currentRole);
        await roleControl.click();
        await this.page.getByRole('menu').last().getByRole('menuitem', {name: newRole, exact: true}).click();
        await expect(roleControl).toHaveText(newRole, {timeout: duration.half_min});
    }

    async expectMembershipRole(displayName: string, role: MembershipRole) {
        const roleControl = this.page.getByTestId(`${displayName}_current_role`);
        await expect(roleControl).toHaveText(role, {timeout: duration.half_min});
    }

    async attemptToLeave() {
        await this.page.getByRole('link', {name: 'Edition and License', exact: true}).click();
        await expect(this.page.getByRole('dialog')).toContainText(/discard/i);
    }

    async cancelLeaving() {
        await this.page.getByRole('dialog').getByRole('button', {name: 'Cancel', exact: true}).click();
    }

    async expectDefaultChannelsAvailable(teamDisplayName: string) {
        await this.page.getByRole('button', {name: /^Add Team or Channel/}).click();
        await this.page.getByRole('menuitem', {name: 'Add Channel', exact: true}).click();
        const dialog = this.page.getByRole('dialog').last();
        await dialog.getByRole('combobox', {name: 'Search and add channels', exact: true}).fill('off-');
        const status = dialog.getByRole('status');
        await expect(status).toContainText(/results? found/);
        expect(Number.parseInt((await status.textContent()) ?? '0', 10)).toBeGreaterThan(1);
        const defaultChannel = dialog.getByText(
            new RegExp(`^Off-Topic\\s*\\(\\s*${escapeRegExp(teamDisplayName)}\\s*\\)$`),
        );
        await expect(defaultChannel).toBeVisible({timeout: duration.half_min});
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
