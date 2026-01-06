// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class TeamMenu {
    readonly container: Locator;

    readonly invitePeople: Locator;
    readonly teamSettings: Locator;
    readonly manageMembers: Locator;
    readonly leaveTeam: Locator;
    readonly createTeam: Locator;
    readonly learnAboutTeams: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.invitePeople = container.getByRole('menuitem', {name: 'Invite people Add or invite people to the team'});
        this.teamSettings = container.getByRole('menuitem', {name: 'Team settings'});
        this.manageMembers = container.getByRole('menuitem', {name: 'Manage members'});
        this.leaveTeam = container.getByRole('menuitem', {name: 'Leave team'});
        this.createTeam = container.getByRole('menuitem', {name: 'Create a team'});
        this.learnAboutTeams = container.getByRole('menuitem', {name: 'Learn about teams'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getContainerId() {
        return this.container.getAttribute('id');
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
