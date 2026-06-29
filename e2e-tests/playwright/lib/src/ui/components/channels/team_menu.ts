// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class TeamMenu extends BaseComponent {
    readonly invitePeople: Locator;
    readonly teamSettings: Locator;
    readonly manageMembers: Locator;
    readonly leaveTeam: Locator;
    readonly createTeam: Locator;
    readonly learnAboutTeams: Locator;

    constructor(container: Locator) {
        super(container);

        this.invitePeople = container.getByRole('menuitem', {
            name: en['sidebarLeft.teamMenu.invitePeopleMenuItem.primaryLabel'],
        });
        this.teamSettings = container.getByRole('menuitem', {
            name: en['sidebarLeft.teamMenu.teamSettingsMenuItem.primaryLabel'],
        });
        this.manageMembers = container.getByRole('menuitem', {
            name: en['sidebarLeft.teamMenu.manageMembersMenuItem.primaryLabel'],
        });
        this.leaveTeam = container.getByRole('menuitem', {
            name: en['sidebarLeft.teamMenu.leaveTeamMenuItem.primaryLabel'],
        });
        this.createTeam = container.getByRole('menuitem', {
            name: en['sidebarLeft.teamMenu.createTeamMenuItem.primaryLabel'],
        });
        this.learnAboutTeams = container.getByRole('menuitem', {
            name: en['sidebarLeft.teamMenu.learnAboutTeamsMenuItem.primaryLabel'],
        });
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getContainerId() {
        return (await this.container.getAttribute('id')) ?? '';
    }

    async clickInvitePeople() {
        await this.invitePeople.click();
    }

    async clickTeamSettings() {
        await this.teamSettings.click();
    }

    async clickManageMembers() {
        await this.manageMembers.click();
    }

    async clickLeaveTeam() {
        await this.leaveTeam.click();
    }

    async clickCreateTeam() {
        await this.createTeam.click();
    }

    async clickLearnAboutTeams() {
        await this.learnAboutTeams.click();
    }
}
