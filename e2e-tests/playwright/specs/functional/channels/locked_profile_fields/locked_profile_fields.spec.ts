// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {ServerError} from '@mattermost/types/errors';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    ChannelsPage,
    expect,
    extractEmailLink,
    getRecentEmail,
    test,
    type SystemConsolePage,
} from '@mattermost/playwright-lib';

type LockSetting = 'none' | 'name_and_username' | 'all';

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

test.afterEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    await adminClient.patchConfig({
        AnnouncementSettings: {AdminNoticesEnabled: true, UserNoticesEnabled: true},
        ServiceSettings: {EnableEmailInvitations: false},
        TeamSettings: {LockProfileFieldsForEmailUsers: 'none'},
    });
});

/**
 * @objective Verify email invite rows suggest profile fields only for first.last addresses when profile locking is enabled.
 * @precondition An Enterprise license and email invitations are enabled.
 */
test(
    'suggests profile details for business-style email invites and leaves personal-style invites blank',
    {tag: '@locked_profile_fields'},
    async ({pw}) => {
        const {user, adminClient, team} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');

        // # Open the team invite modal as a member with invite permission.
        const {channelsPage} = await pw.testBrowser.login(user);
        const inviteModal = await openInviteModal(channelsPage, team);

        // # Add a first.last email address.
        const businessEmail = `jane.doe@${pw.random.id()}.example.com`;
        await inviteModal.addEmail(businessEmail);
        const businessProfile = inviteModal.getProfileRow(businessEmail);

        // * The row suggests the name and username derived from the email local part.
        await expect(inviteModal.profileInputs).toBeVisible();
        await expect(businessProfile.firstNameInput).toHaveValue('Jane');
        await expect(businessProfile.lastNameInput).toHaveValue('Doe');
        await expect(businessProfile.usernameInput).toHaveValue('jane.doe');

        // # Add a personal-style email address to the same invitation.
        const personalEmail = `xyz123@${pw.random.id()}.example.com`;
        await inviteModal.addEmail(personalEmail);
        const personalProfile = inviteModal.getProfileRow(personalEmail);

        // * Personal-style addresses have editable profile fields without automatic suggestions.
        await expect(personalProfile.firstNameInput).toHaveValue('');
        await expect(personalProfile.lastNameInput).toHaveValue('');
        await expect(personalProfile.usernameInput).toHaveValue('');

        // * Adding another email does not re-seed the first row's suggestions.
        await expect(businessProfile.firstNameInput).toHaveValue('Jane');
        await expect(businessProfile.lastNameInput).toHaveValue('Doe');
        await expect(businessProfile.usernameInput).toHaveValue('jane.doe');
    },
);

/**
 * @objective Verify profile inputs are absent from email invites when profile locking is disabled.
 * @precondition Email invitations are enabled.
 */
test(
    'does not show profile detail inputs when email profile locking is disabled',
    {tag: '@locked_profile_fields'},
    async ({pw}) => {
        const {user, adminClient, team} = await pw.initSetup();
        await setLockConfig(adminClient, 'none');

        // # Open the invite modal and add an email address.
        const {channelsPage} = await pw.testBrowser.login(user);
        const inviteModal = await openInviteModal(channelsPage, team);
        await inviteModal.addEmail(`jane.doe@${pw.random.id()}.example.com`);

        // * The invite remains a normal email invite without pre-provisioned profile inputs.
        await expect(inviteModal.profileInputs).not.toBeAttached();
    },
);

/**
 * @objective Verify an email invite with a pre-set username that is already taken fails
 * gracefully in the invite results instead of dead-ending the invitee at signup.
 * @precondition An Enterprise license and email invitations are enabled.
 */
test(
    'reports a taken pre-set username in the invite results without sending the invite',
    {tag: '@locked_profile_fields'},
    async ({pw}) => {
        const {user, adminClient, team} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');

        // # Create a user that already owns the username about to be pre-set.
        const existingUser = await adminClient.createUser(await pw.random.user('existing'), '', '');

        // # Invite a new email address and pre-set the taken username.
        const {channelsPage} = await pw.testBrowser.login(user);
        const inviteModal = await openInviteModal(channelsPage, team);
        const invitedEmail = `taken.username@${pw.random.id()}.example.com`;
        await inviteModal.addEmail(invitedEmail);
        const profile = inviteModal.getProfileRow(invitedEmail);
        await profile.usernameInput.fill(existingUser.username);
        await inviteModal.submitInvites();

        // * The result view lists the email as not sent with the username-conflict reason.
        const resultModal = await channelsPage.getMembersInvitedModal(team.display_name);
        await resultModal.toBeVisible();
        await expect(resultModal.notSentSection).toBeVisible();
        await expect(resultModal.notSentSection.getByText(invitedEmail)).toBeVisible();
        await expect(resultModal.notSentSection.getByTestId('invitation-result-reason')).toHaveText(
            `The username ${existingUser.username} is already taken.`,
        );
        await expect(resultModal.sentSection).not.toBeVisible();
    },
);

/**
 * @objective Verify an admin-provisioned email invite controls signup data even when the signup
 * link and form are tampered with, and locks the resulting member profile.
 * @precondition An Enterprise license, Inbucket, and email invitations are available.
 */
test(
    'carries admin-provisioned profile data from invite email through signup and enforces the lock',
    {tag: '@locked_profile_fields'},
    async ({pw, page}) => {
        test.setTimeout(90_000);

        const {adminUser, adminClient, team} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');

        const uniqueId = pw.random.id(6);
        const invitedEmail = `new.user@${uniqueId}.example.com`;
        const invitedUsername = `jane.doe.${uniqueId}`;
        const password = pw.newTestPassword();

        // # Invite a new member through the modal and set the authoritative profile details.
        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        const inviteModal = await openInviteModal(adminChannelsPage, team);
        await inviteModal.addEmail(invitedEmail);
        const profile = inviteModal.getProfileRow(invitedEmail);
        await profile.firstNameInput.fill('Jane');
        await profile.lastNameInput.fill('Doe');
        await profile.usernameInput.fill(invitedUsername);
        const invitationStarted = new Date(Date.now() - 5_000);
        await inviteModal.submitInvites();
        const resultModal = await adminChannelsPage.getMembersInvitedModal(team.display_name);
        await resultModal.toBeVisible();

        // # Retrieve the real invitation from Inbucket and open its signup link logged out.
        const invitationEmail = await getRecentEmail(invitedEmail, {receivedAfter: invitationStarted});
        const signupLink = extractEmailLink(invitationEmail, '/signup_user_complete/');
        await pw.hasSeenLandingPage();
        await pw.signupPage.goto(signupLink);
        await pw.signupPage.toBeVisible();

        // * Signup displays the authoritative username and full name supplied by the admin.
        await expect(pw.signupPage.usernameInput).toHaveValue(invitedUsername);
        await expect(pw.signupPage.usernameInput).toBeDisabled();
        await expect(pw.signupPage.adminChosenUsernameMessage).toBeVisible();
        await expect(pw.signupPage.presetName).toHaveText("You'll join as Jane Doe.");

        // # Tamper with the link's d= display payload, which the server must not trust.
        const tamperedUrl = new URL(signupLink);
        const tamperedData = JSON.parse(tamperedUrl.searchParams.get('d') ?? '{}');
        tamperedData.username = `hacked${uniqueId}`;
        tamperedData.first_name = 'Hacked';
        tamperedUrl.searchParams.set('d', JSON.stringify(tamperedData));
        await pw.signupPage.goto(tamperedUrl.toString());
        await pw.signupPage.toBeVisible();
        await expect(pw.signupPage.usernameInput).toHaveValue(`hacked${uniqueId}`);

        // # Also force the locked username input editable in the DOM and submit yet another value.
        const domTamperedUsername = `sneaky${uniqueId}`;
        await pw.signupPage.usernameInput.evaluate((element, value) => {
            const input = element as HTMLInputElement;
            input.removeAttribute('disabled');
            const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            setValue?.call(input, value);
            input.dispatchEvent(new Event('input', {bubbles: true}));
        }, domTamperedUsername);
        await expect(pw.signupPage.usernameInput).toHaveValue(domTamperedUsername);

        // # Complete signup with a password despite the tampered form.
        await pw.signupPage.createInvitedUser(password);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.toBeVisible();

        // * The new member carries the invite token's profile, not the tampered values.
        await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/town-square`));
        const createdUser = await adminClient.getUserByEmail(invitedEmail);
        expect(createdUser.username).toBe(invitedUsername);
        expect(createdUser.first_name).toBe('Jane');
        expect(createdUser.last_name).toBe('Doe');

        // # Dismiss first-login guidance so Profile settings can be exercised without an overlay.
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

        // # Open the new member's profile settings and inspect each protected row.
        const profileModal = await channelsPage.openProfileModal();
        await profileModal.openSection('name');

        // * First and last name are replaced by the admin-managed message and cannot be edited.
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.firstNameInput).not.toBeVisible();
        await expect(profileModal.lastNameInput).not.toBeVisible();
        await expect(profileModal.saveButton).not.toBeVisible();
        await profileModal.closeSection();

        // # Open the username row.
        await profileModal.openSection('username');

        // * Username is also managed by the System Admin with no edit input.
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.usernameInput).not.toBeVisible();
        await expect(profileModal.saveButton).not.toBeVisible();
        await profileModal.closeSection();

        // # Open the email row.
        await profileModal.openSection('email');

        // * Email remains editable even while name and username are locked.
        await expect(profileModal.newEmailInput).toBeVisible();
        await expect(profileModal.confirmEmailInput).toBeVisible();
        await expect(profileModal.currentPasswordInput).toBeVisible();
        await profileModal.closeSection();

        // # Attempt to bypass the UI by changing the member's first name through the API.
        const {client: invitedUserClient} = await pw.makeClient({username: invitedUsername, password});
        let updateError: ServerError | undefined;
        try {
            await invitedUserClient.patchMe({first_name: 'Changed'});
        } catch (error) {
            updateError = error as ServerError;
        }

        // * The server rejects the protected profile update with HTTP 409.
        expect(updateError?.status_code).toBe(409);
        expect((await adminClient.getUser(createdUser.id)).first_name).toBe('Jane');
    },
);

/**
 * @objective Verify empty first and last names can each be filled once, locking per field as
 * they gain a value and locking the whole section once both are set.
 * @precondition An Enterprise license is available.
 */
test('locks first and last names per field as each is filled once', {tag: '@locked_profile_fields'}, async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    await adminClient.patchUser({id: user.id, first_name: '', last_name: ''});
    await setLockConfig(adminClient, 'name_and_username');

    // # Log in as the email user and open the empty Full Name row.
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.openSection('name');

    // * Both empty names remain fully editable for their first value.
    await expect(profileModal.firstNameInput).toBeEnabled();
    await expect(profileModal.lastNameInput).toBeEnabled();
    await expect(profileModal.managedByAdminMessage).not.toBeVisible();

    // # Fill only the first name and save.
    await profileModal.firstNameInput.fill('First');
    await profileModal.saveButton.click();
    await expect(profileModal.getSectionEditButton('name')).toBeVisible();
    await expect
        .poll(async () => {
            const updatedUser = await adminClient.getUser(user.id);
            return `${updatedUser.first_name}|${updatedUser.last_name}`;
        })
        .toBe('First|');

    // # Reopen the Full Name row now that exactly one name is set.
    await profileModal.openSection('name');

    // * The saved first name is disabled with the admin-managed explanation while the
    // * still-empty last name stays editable.
    await expect(profileModal.firstNameInput).toBeVisible();
    await expect(profileModal.firstNameInput).toBeDisabled();
    await expect(profileModal.lastNameInput).toBeEnabled();
    await expect(profileModal.managedByAdminMessage).toBeVisible();

    // # Fill the remaining last name and save.
    await profileModal.lastNameInput.fill('Last');
    await profileModal.saveButton.click();
    await expect(profileModal.getSectionEditButton('name')).toBeVisible();
    await expect
        .poll(async () => {
            const updatedUser = await adminClient.getUser(user.id);
            return `${updatedUser.first_name} ${updatedUser.last_name}`;
        })
        .toBe('First Last');

    // # Reload and reopen the Full Name row with both names populated.
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();
    const lockedProfileModal = await channelsPage.openProfileModal();
    await lockedProfileModal.openSection('name');

    // * The fully populated names are now managed by the System Admin with no inputs at all.
    await expect(lockedProfileModal.managedByAdminMessage).toBeVisible();
    await expect(lockedProfileModal.firstNameInput).not.toBeVisible();
    await expect(lockedProfileModal.lastNameInput).not.toBeVisible();
    await expect(lockedProfileModal.saveButton).not.toBeVisible();
});

/**
 * @objective Verify the all setting locks nickname and position while leaving email editable.
 * @precondition An Enterprise license is available.
 */
test(
    'locks nickname and position with the all setting while keeping email editable',
    {tag: '@locked_profile_fields'},
    async ({pw}) => {
        const {user, adminClient, team} = await pw.initSetup();
        await adminClient.patchUser({id: user.id, position: 'Engineer'});
        await setLockConfig(adminClient, 'all');

        // # Log in as the email user and open Profile settings.
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const profileModal = await channelsPage.openProfileModal();

        // # Open the populated Nickname row.
        await profileModal.openSection('nickname');

        // * Nickname shows the admin-managed message without an edit input.
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.nicknameInput).not.toBeVisible();
        await expect(profileModal.saveButton).not.toBeVisible();
        await profileModal.closeSection();

        // # Open the populated Position row.
        await profileModal.openSection('position');

        // * Position shows the admin-managed message without an edit input.
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.positionInput).not.toBeVisible();
        await expect(profileModal.saveButton).not.toBeVisible();
        await profileModal.closeSection();

        // # Open the Email row under the same all setting.
        await profileModal.openSection('email');

        // * Email retains its normal editing fields.
        await expect(profileModal.newEmailInput).toBeVisible();
        await expect(profileModal.confirmEmailInput).toBeVisible();
        await expect(profileModal.currentPasswordInput).toBeVisible();
        await profileModal.closeSection();

        // # Open the Profile Picture row.
        await profileModal.openSection('picture');

        // * The picture shows the admin-managed message without upload or save controls.
        await expect(profileModal.managedByAdminMessage).toBeVisible();
        await expect(profileModal.pictureSelectButton).not.toBeVisible();
        await expect(profileModal.pictureSaveButton).not.toBeVisible();
    },
);

/**
 * @objective Verify a System Admin can edit an email user's first and last name while profile locking is enabled.
 * @precondition An Enterprise license is available.
 */
test(
    'allows a System Admin to edit locked first and last names from the user detail page',
    {tag: '@locked_profile_fields'},
    async ({pw}) => {
        const {user, adminUser, adminClient} = await pw.initSetup();
        await setLockConfig(adminClient, 'name_and_username');
        const newFirstName = `AdminFirst${pw.random.id(5)}`;
        const newLastName = `AdminLast${pw.random.id(5)}`;

        // # Open the locked email user's System Console detail page as System Admin.
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await navigateToUserDetail(systemConsolePage, user);
        const {userDetail} = systemConsolePage.users;

        // * First and last name remain editable for the exempt System Admin.
        await expect(userDetail.userCard.firstNameInput).toBeEnabled();
        await expect(userDetail.userCard.lastNameInput).toBeEnabled();

        // # Change both names and confirm the save.
        await userDetail.userCard.firstNameInput.fill(newFirstName);
        await userDetail.userCard.lastNameInput.fill(newLastName);
        await userDetail.save();
        await userDetail.saveChangesModal.confirm();

        // * The edited names persist in both the UI and server API.
        await expect(userDetail.userCard.firstNameInput).toHaveValue(newFirstName);
        await expect(userDetail.userCard.lastNameInput).toHaveValue(newLastName);
        const updatedUser = await adminClient.getUser(user.id);
        expect(updatedUser.first_name).toBe(newFirstName);
        expect(updatedUser.last_name).toBe(newLastName);
    },
);

async function setLockConfig(adminClient: Client4, lockSetting: LockSetting) {
    await adminClient.patchConfig({
        // Product notices are fetched from an external server and pop up over the
        // channels view on first login, blocking clicks on the team menu.
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

async function navigateToUserDetail(systemConsolePage: SystemConsolePage, user: UserProfile) {
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.users.click();
    await systemConsolePage.users.toBeVisible();
    await systemConsolePage.users.searchUsers(user.email);
    const userRow = systemConsolePage.users.usersTable.getRowByIndex(0);
    await expect(userRow.container.getByText(user.email)).toBeVisible();
    await userRow.container.getByText(user.email).click();
    await systemConsolePage.users.userDetail.toBeVisible();
}
