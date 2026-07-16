// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import {ChannelsPage, expect, extractEmailLink, getRecentEmail, test} from '@mattermost/playwright-lib';

type LockSetting = 'none' | 'name_and_username' | 'all';

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

/**
 * @objective Verify pre-set invite profile data survives email signup and is locked for the new member.
 * @precondition An Enterprise license, Inbucket, and email invitations are available.
 */
test(
    'carries admin-provisioned profile data from invite email through signup and enforces the lock',
    {tag: '@locked_profile_fields'},
    async ({pw, page}) => {
        test.setTimeout(90_000);

        // # Invite and register a member with administrator-provided profile details.
        const {adminUser, adminClient, team} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');

        const uniqueId = pw.random.id(6);
        const invitedEmail = `new.user@${uniqueId}.example.com`;
        const invitedUsername = `jane.doe.${uniqueId}`;

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        const inviteModal = await openInviteModal(adminChannelsPage, team);
        await inviteModal.addEmail(invitedEmail);
        const profile = inviteModal.getProfileRow(invitedEmail);
        await profile.firstNameInput.fill('Jane');
        await profile.lastNameInput.fill('Doe');
        await profile.usernameInput.fill(invitedUsername);
        const invitationStarted = new Date(Date.now() - 5_000);
        await inviteModal.submitInvites();
        await (await adminChannelsPage.getMembersInvitedModal(team.display_name)).toBeVisible();

        const invitationEmail = await getRecentEmail(invitedEmail, {receivedAfter: invitationStarted});
        const signupLink = extractEmailLink(invitationEmail, '/signup_user_complete/');
        await pw.hasSeenLandingPage();
        await pw.signupPage.goto(signupLink);
        await pw.signupPage.toBeVisible();

        await expect(pw.signupPage.usernameInput).toHaveValue(invitedUsername);
        await expect(pw.signupPage.usernameInput).toBeDisabled();
        await expect(pw.signupPage.adminChosenUsernameMessage).toBeVisible();
        await expect(pw.signupPage.presetName).toHaveText("You'll join as Jane Doe.");

        await pw.signupPage.createInvitedUser(pw.newTestPassword());
        const channelsPage = new ChannelsPage(page);
        await channelsPage.toBeVisible();

        const createdUser = await adminClient.getUserByEmail(invitedEmail);
        expect(createdUser.username).toBe(invitedUsername);
        expect(createdUser.first_name).toBe('Jane');
        expect(createdUser.last_name).toBe('Doe');

        // * The resulting member cannot edit the managed name or username fields.
        await adminClient.savePreferences(createdUser.id, [
            {user_id: createdUser.id, category: 'tutorial_step', name: createdUser.id, value: '999'},
            {
                user_id: createdUser.id,
                category: 'onboarding_task_list',
                name: 'onboarding_task_list_show',
                value: 'false',
            },
        ]);
        await page.reload();
        await channelsPage.toBeVisible();

        const profileModal = await channelsPage.openProfileModal();
        await profileModal.openSection('name');
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.firstNameInput).not.toBeVisible();
        await expect(profileModal.lastNameInput).not.toBeVisible();
        await expect(profileModal.saveButton).not.toBeVisible();
        await profileModal.closeSection();

        await profileModal.openSection('username');
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.usernameInput).not.toBeVisible();
        await expect(profileModal.saveButton).not.toBeVisible();
    },
);

/**
 * @objective Verify a System Admin can edit an email user's locked first and last names.
 * @precondition An Enterprise license is available.
 */
test(
    'allows a System Admin to edit locked first and last names from the user detail page',
    {tag: '@locked_profile_fields'},
    async ({pw}) => {
        // # Edit the locked member's name from the System Console.
        const {user, adminUser, adminClient} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');
        const newFirstName = `AdminFirst${pw.random.id(5)}`;
        const newLastName = `AdminLast${pw.random.id(5)}`;

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.page.goto(`/admin_console/user_management/user/${user.id}`);
        const {userDetail} = systemConsolePage.users;
        await userDetail.toBeVisible();

        await expect(userDetail.userCard.firstNameInput).toBeEnabled();
        await expect(userDetail.userCard.lastNameInput).toBeEnabled();
        await userDetail.userCard.firstNameInput.fill(newFirstName);
        await userDetail.userCard.lastNameInput.fill(newLastName);
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * The administrator's changes persist in the UI and API.
        await expect(userDetail.userCard.firstNameInput).toHaveValue(newFirstName);
        await expect(userDetail.userCard.lastNameInput).toHaveValue(newLastName);
        const updatedUser = await adminClient.getUser(user.id);
        expect(updatedUser.first_name).toBe(newFirstName);
        expect(updatedUser.last_name).toBe(newLastName);
    },
);

async function setLockConfig(adminClient: Client4, lockSetting: LockSetting) {
    await adminClient.patchConfig({
        AnnouncementSettings: {AdminNoticesEnabled: false, UserNoticesEnabled: false},
        ServiceSettings: {EnableEmailInvitations: true},
        TeamSettings: {LockProfileFieldsForEmailUsers: lockSetting},
    });
    await expect
        .poll(async () => {
            const config = await adminClient.getConfig();
            return {
                emailInvitations: config.ServiceSettings?.EnableEmailInvitations,
                profileLock: config.TeamSettings?.LockProfileFieldsForEmailUsers,
            };
        })
        .toEqual({emailInvitations: true, profileLock: lockSetting});
}

async function openInviteModal(channelsPage: ChannelsPage, team: Team) {
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.sidebarLeft.teamMenuButton.click();
    await channelsPage.teamMenu.toBeVisible();
    await channelsPage.teamMenu.clickInvitePeople();
    const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
    await inviteModal.toBeVisible();
    return inviteModal;
}
