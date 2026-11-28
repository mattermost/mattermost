// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import {
    App,
    expect,
    extractEmailLink,
    getRecentEmail,
    test,
    duration,
    DefaultChannel,
    Msg,
} from '@mattermost/playwright-lib';

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
        test.setTimeout(duration.two_min);

        // # Invite and register a member with administrator-provided profile details.
        const {adminUser, adminClient, team} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');
        const uniqueId = pw.random.id(6);
        const invitedEmail = `new.user@${uniqueId}.example.com`;
        const invitedUsername = `jane.doe.${uniqueId}`;

        const {app: admin} = await pw.testBrowser.login(adminUser);
        const invite = await openInvite(admin, team);
        await addEmail(admin, invitedEmail);
        const profile = await invite.memberProfiles.memberList.itemWith({text: invitedEmail});
        await profile.firstName.container.fill('Jane');
        await profile.lastName.container.fill('Doe');
        await profile.username.container.fill(invitedUsername);
        const invitationStarted = new Date(Date.now() - 5_000);
        await invite.sendButton.click();
        await expect(admin.invitationModal.result.doneButton).toBeVisible();

        const invitationEmail = await getRecentEmail(invitedEmail, {receivedAfter: invitationStarted});
        const signupLink = extractEmailLink(invitationEmail, '/signup_user_complete/');

        await pw.hasSeenLandingPage();
        const app = new App(page);
        await page.goto(signupLink);
        const {card} = app.signup;
        await expect(app.signup.titleText).toHaveMessage(Msg.signup_user_completed.title);
        await expect(card.email.container).toBeVisible();
        await expect(card.username.container).toBeVisible();
        await expect(card.password.container).toBeVisible();
        await expect(card.username.container).toHaveValue(invitedUsername);
        await expect(card.username.container).toBeDisabled();
        await expect(card.username.messageText).toBeVisible();
        await expect(card.username.messageText).toHaveMessage(Msg.signup_user_completed.usernameIs);
        await expect(card.presetNameText).toBeVisible();
        await expect(card.presetNameText).toHaveText("You'll join as Jane Doe.");
        await card.password.container.fill(pw.newTestPassword());
        await card.termsCheckbox.set(true);
        await expect(card.termsCheckbox).toBeChecked();
        await card.createAccountButton.click();
        await expect(page).not.toHavePath(app.signupPage.pathFor());
        await expect(app.center.postCreate).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

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
        await expect(app.globalHeader.openAccountMenuButton).toBeVisible();
        await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.profileMenuItem);
        await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);

        const name = app.settings.general.section('name');
        await name.editButton.click();
        await expect(name.managedByAdminText).toBeVisible();
        await expect(name.firstName.container).not.toBeVisible();
        await expect(name.lastName.container).not.toBeVisible();
        await expect(name.saveButton).not.toBeVisible();
        await name.cancelButton.click();
        await expect(name.editButton).toBeVisible();

        const username = app.settings.general.section('username');
        await username.editButton.click();
        await expect(username.managedByAdminText).toBeVisible();
        await expect(username.username.container).not.toBeVisible();
        await expect(username.saveButton).not.toBeVisible();
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

        const {app, page} = await pw.testBrowser.login(adminUser);
        await page.goto(`/admin_console/user_management/user/${user.id}`);
        const userDetail = app.admin.user;
        await expect(userDetail.firstNameTextbox).toBeEnabled();
        await expect(userDetail.lastNameTextbox).toBeEnabled();
        await userDetail.firstNameTextbox.fill(newFirstName);
        await userDetail.lastNameTextbox.fill(newLastName);
        const confirm = await userDetail.saveButton.clickTo(userDetail.saveChangesModal);
        await confirm.confirmButton.click();

        // * The administrator's changes persist in the UI and API.
        await expect(userDetail.firstNameTextbox).toHaveValue(newFirstName);
        await expect(userDetail.lastNameTextbox).toHaveValue(newLastName);
        const updatedUser = await adminClient.getUser(user.id);
        expect(updatedUser.first_name).toBe(newFirstName);
        expect(updatedUser.last_name).toBe(newLastName);
    },
);

async function setLockConfig(adminClient: Client4, lockSetting: LockSetting) {
    await adminClient.patchConfig({
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

/** Opens the team's Invite People dialog from the team menu. */
async function openInvite(app: App, team: Team): Promise<App['invitationModal']['invite']> {
    await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.invitePeopleMenuItem);
    await app.lhs.teamMenu.invitePeopleMenuItem.clickTo(app.invitationModal);
    await expect(app.invitationModal.invite.users.inputCombobox).toBeVisible();
    return app.invitationModal.invite;
}

/** Adds an email to the invite list, taking the menu's suggestion once its search finishes. */
async function addEmail(app: App, email: string) {
    const {users} = app.invitationModal.invite;
    const input = users.inputCombobox.locator;
    await input.click();
    await expect(input).toBeFocused();
    await input.pressSequentially(email, {delay: 50});
    await expect(users.emailOption).toBeVisible({timeout: duration.half_min});
    await input.press('Enter');
    await expect(input).toHaveValue('');
}
