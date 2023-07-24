// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @ldap

import * as TIMEOUTS from '../../../../fixtures/timeouts';

function setLDAPTestSettings(config) {
    return {
        siteName: config.TeamSettings.SiteName,
        siteUrl: config.ServiceSettings.SiteURL,
        teamName: '',
        user: null,
    };
}

// assumes the CYPRESS_* variables are set
// assumes that E20 license is uploaded
// for setup with AWS: Follow the instructions mentioned in the mattermost/platform-private/config/ldap-test-setup.txt file
context('ldap', () => {
    let testChannel;
    let testTeam;
    let testUser;

    describe('LDAP Group Sync Automated Tests', () => {
        beforeEach(() => {
            // # Login as sysadmin and add board-one to test team
            cy.apiAdminLogin();

            // * Check if server has license for LDAP
            cy.apiRequireLicenseForFeature('LDAP');

            // # Initial api setup
            cy.apiInitSetup().then(({team, user}) => {
                testTeam = team;
                testUser = user;

                // # Update LDAP settings
                cy.apiGetConfig().then(({config}) => {
                    setLDAPTestSettings(config);
                });

                // # Link board group
                cy.visit('/admin_console/user_management/groups');
                cy.get('#board_group').then((el) => {
                    if (!el.text().includes('Edit')) {
                        // # Link the Group if its not linked before
                        if (el.find('.icon.fa-unlink').length > 0) {
                            el.find('.icon.fa-unlink').click();
                        }
                    }
                });

                // # Link developers group
                cy.visit('/admin_console/user_management/groups');
                cy.get('#developers_group').then((el) => {
                    if (!el.text().includes('Edit')) {
                        // # Link the Group if its not linked before
                        if (el.find('.icon.fa-unlink').length > 0) {
                            el.find('.icon.fa-unlink').click();
                        }
                    }
                });

                // # Create a test channel
                cy.apiCreateChannel(testTeam.id, 'ldap-group-sync-automated-tests', 'ldap-group-sync-automated-tests').then(({channel}) => {
                    testChannel = channel;
                });
            });
        });

        it('MM-T1537 - Sync Group Removal from Channel Configuration Page', () => {
            // # Link 2 groups to testChannel
            cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');
            cy.wait(TIMEOUTS.TWO_SEC); //eslint-disable-line cypress/no-unnecessary-waiting

            // # Link first group
            cy.get('#addGroupsToChannelToggle').click();
            cy.get('#multiSelectList').should('be.visible');
            cy.get('#multiSelectList>div').children().eq(0).click();
            cy.uiGetButton('Add').click();

            // # Link second group
            cy.get('#addGroupsToChannelToggle').click();
            cy.get('#multiSelectList').should('be.visible');
            cy.get('#multiSelectList>div').children().eq(0).click();
            cy.uiGetButton('Add').click();

            // # Click save settings on bottom screen to save settings
            cy.get('#saveSetting').should('be.enabled').click();
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Mattermost Channels');

            // # Go back to the testChannel management page
            cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

            // # Remove the board group we have added
            cy.get('.group-row').eq(0).scrollIntoView().should('be.visible').within(() => {
                cy.get('.group-name').should('have.text', 'board');
                cy.get('.group-actions > a').should('have.text', 'Remove').click();
            });

            // # Save settings
            cy.get('#saveSetting').should('be.enabled').click();
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Mattermost Channels');

            // # Go back to testChannel management page
            cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

            // * Ensure we only have one group row (other group is not there)
            cy.get('.group-row').should('have.length', 1);
        });

        it('MM-T2618 - Team Configuration Page: Group removal User removed from sync\'ed team', () => {
            // # Add board-one to test team
            cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Team Configuration');
            cy.wait(TIMEOUTS.TWO_SEC); //eslint-disable-line cypress/no-unnecessary-waiting

            // # Turn on sync group members
            cy.findByTestId('syncGroupSwitch').
                scrollIntoView().
                findByRole('button').
                click({force: true});

            // # Add board group to team
            cy.get('#addGroupsToTeamToggle').scrollIntoView().click();
            cy.get('#multiSelectList').should('be.visible');
            cy.get('#multiSelectList>div').children().eq(0).click();
            cy.uiGetButton('Add').click().wait(TIMEOUTS.ONE_SEC);

            // # Save settings
            cy.get('#saveSetting').should('be.enabled').click();

            // # Accept confirmation modal
            cy.get('#confirmModalButton').should('be.visible').click();
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Mattermost Teams');

            // # Go to board group edit page
            cy.visit('/admin_console/user_management/groups');
            cy.get('#board_edit').click();

            // # Remove the group
            cy.findByTestId(`${testTeam.display_name}_groupsyncable_remove`).click();

            // * Ensure the confirmation modal shows with the following text
            cy.get('#confirmModalBody').should('be.visible').and('have.text', `Removing this membership will prevent future users in this group from being added to the ${testTeam.display_name} team.`);

            // # Accept the modal and save settings
            cy.get('#confirmModalButton').should('be.visible').click();
            cy.get('#saveSetting').click();
        });

        it('MM-T2621 - Team List Management Column', () => {
            let testTeam2;

            // # Go to testTeam config page
            cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Team Configuration');
            cy.wait(TIMEOUTS.TWO_SEC); //eslint-disable-line cypress/no-unnecessary-waiting

            // # Make the team so anyone can join it
            cy.findByTestId('allowAllToggleSwitch').scrollIntoView().click();

            // # Save the settings
            cy.get('#saveSetting').should('be.enabled').click();
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Mattermost Teams');

            // # Start with a new team
            cy.apiCreateTeam('team', 'Team').then(({team}) => {
                testTeam2 = team;

                // # Go to team management
                cy.visit('/admin_console/user_management/teams');

                // # Search for the team testTeam
                cy.get('.DataGrid_searchBar').within(() => {
                    cy.findByPlaceholderText('Search').should('be.visible').type(`${testTeam.display_name}{enter}`);
                });

                // * Ensure anyone can join text shows
                cy.findByTestId(`${testTeam.name}Management`).should('have.text', 'Anyone Can Join');

                // * Search for second team we just made
                cy.get('.DataGrid_searchBar').within(() => {
                    cy.findByPlaceholderText('Search').should('be.visible').clear().type(`${testTeam2.display_name}{enter}`);
                });

                // * Ensure the management text shows Invite only
                cy.findByTestId(`${testTeam2.name}Management`).should('have.text', 'Invite Only');
            });
        });

        it('MM-T2628 - List of Channels', () => {
            // # Add board-one to test team
            cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');
            cy.wait(TIMEOUTS.TWO_SEC); //eslint-disable-line cypress/no-unnecessary-waiting

            // Make it private and then cancel
            cy.findByTestId('allow-all-toggle').click();
            cy.get('#cancelButtonSettings').click();
            cy.get('#confirmModalButton').click();
            cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

            // * Ensure it still public
            cy.findByTestId('allow-all-toggle').should('has.have.text', 'Public');

            // Make it private and save
            cy.findByTestId('allow-all-toggle').click();
            cy.get('#saveSetting').should('be.enabled').click();
            cy.get('#confirmModalButton').click();

            // # Visit the channel config page for testChannel
            cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
            cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

            // * Ensure it is Private
            cy.findByTestId('allow-all-toggle').should('has.have.text', 'Private');

            // # Go to team page to look for this channel in public channel directory
            cy.visit(`/${testTeam.name}`);
            cy.uiBrowseOrCreateChannel('Browse channels').click();

            // * Search private channel name and make sure it isn't there in public channel directory
            cy.get('#searchChannelsTextbox').type(testChannel.display_name);
            cy.get('#moreChannelsList').should('include.text', 'No results for');
        });

        it('MM-T2629 - Private to public - More....', () => {
            // # Create new test channel that is private
            cy.apiCreateChannel(
                testTeam.id,
                'private-channel-test',
                'Private channel',
                'P',
            ).then(({channel}) => {
                const privateChannel = channel;

                // # Visit channel configuration of private channel
                cy.visit(`/admin_console/user_management/channels/${privateChannel.id}`);
                cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

                // Make it public and then cancel
                cy.findByTestId('allow-all-toggle').click();
                cy.get('#cancelButtonSettings').click();
                cy.get('#confirmModalButton').click();
                cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Mattermost Channels');

                // Reload
                cy.visit(`/admin_console/user_management/channels/${privateChannel.id}`);
                cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');
                cy.wait(TIMEOUTS.THREE_SEC); //eslint-disable-line cypress/no-unnecessary-waiting

                // Make it public and save
                // * Ensure it still showing the channel as private
                cy.findByTestId('allow-all-toggle').should('has.have.text', 'Private').click();
                cy.get('#saveSetting').should('be.enabled').click();
                cy.get('#confirmModalButton').click();
                cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Mattermost Channels');

                // Reload
                cy.visit(`/admin_console/user_management/channels/${privateChannel.id}`);
                cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

                // * Ensure it still showing the channel as private
                cy.findByTestId('allow-all-toggle').should('has.have.text', 'Public');

                // # Ensure the last message in the message says that it was converted to a public channel
                cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);
                cy.getLastPostId().then((id) => {
                    // * The system message should contain 'This channel has been converted to a Public Channel and can be joined by any team member'
                    cy.get(`#postMessageText_${id}`).should('contain', 'This channel has been converted to a Public Channel and can be joined by any team member');
                });
            });
        });

        it('MM-T2630 - Default channel cannot be toggled to private', () => {
            cy.visit('/admin_console/user_management/channels');

            // # Search for the channel town square
            cy.get('.DataGrid_searchBar').within(() => {
                cy.findByPlaceholderText('Search').should('be.visible').type('Town Square');
            });
            cy.wait(TIMEOUTS.FIVE_SEC); //eslint-disable-line cypress/no-unnecessary-waiting

            cy.findAllByTestId('town-squareedit').then((elements) => {
                elements[0].click();
                cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Channel Configuration');

                // * Ensure the toggle to private/public is disabled
                cy.findByTestId('allow-all-toggle-button').should('be.disabled');
            });
        });

        it('MM-T2638 - Permalink from when public does not auto-join (non-system-admin) after converting to private', () => {
            cy.apiLogin(testUser);

            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Post message to use
            cy.postMessage('DONT YOU SEE I GOT EVERYTHING YOU NEED .... BABY BABY DONT YOU SEE SEE I GOT EVERYTHING YOU NEED NEED ... ;)');

            cy.getLastPostId().then((id) => {
                const postId = id;

                // # Visit the channel
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Post /leave command in testChannel to leave it
                cy.postMessage('/leave ');
                cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('contain', 'Town Square');

                // Visit the permalink link
                cy.visit(`/${testTeam.name}/pl/${postId}`);

                // * Ensure the header of the permalink channel is what we expect it to be (testChannel)
                cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('contain', testChannel.display_name);

                // # Leave the channel again
                cy.postMessage('/leave ');
                cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('contain', 'Town Square');

                // # Login as sysadmin and convert testChannel to private channel
                cy.apiAdminLogin();
                cy.apiPatchChannelPrivacy(testChannel.id, 'P');

                // # Login as normal user and try to visit the permalink
                cy.apiLogin(testUser);
                cy.visit(`/${testTeam.name}/pl/${postId}`);

                // * We expect an error that says "Message not found"
                cy.findByTestId('errorMessageTitle').contains('Message Not Found');
            });
        });

        it('MM-T2639 - Policy settings (in System Console tests, likely)', () => {
            // # Reset system scheme permission
            cy.uiResetPermissionsToDefault();

            // # Login as testUser and go to channel configuration page of testChannel
            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Go to manage members rhs and ensure that we can add members to it
            cy.get('.member-rhs__trigger').click();
            cy.uiGetRHS().contains('button', 'Add').should('exist').click();

            // * Assess that label is visible and it says we can add new members
            cy.get('#addUsersToChannelModal').should('be.visible').findByText(`Add people to ${testChannel.display_name}`);

            // # Login as sysadmin and navigate to system scheme page and check off all users can manage private manage channels
            cy.apiAdminLogin();
            cy.visit('/admin_console/user_management/permissions/system_scheme');
            cy.findByTestId('all_users-private_channel-checkbox').click();

            // # Save the settings
            cy.uiSaveConfig();

            // # Login as sysadmin and convert testChannel to private channel
            cy.apiPatchChannelPrivacy(testChannel.id, 'P');

            // # Go back to the channel
            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Go to manage member modal
            cy.get('.member-rhs__trigger').click();

            // * Assert that the label doesn't exist anymore mentioning we can invite members
            cy.uiGetRHS().contains('button', 'Add').should('not.exist');
        });

        it('MM-T2640 - Channel appears in channel switcher before conversion but not after (for non-members of the channel)', () => {
            // # Reset system scheme permissions
            cy.uiResetPermissionsToDefault();

            // # Create new test channel that is public
            cy.apiCreateChannel(
                testTeam.id,
                'a-channel-im-not-apart-off',
                'Public channel',
                'O',
            ).then(({channel: publicChannel}) => {
                cy.apiLogin(testUser);

                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Open Find Channels
                cy.uiOpenFindChannels();

                // * Channel switcher hint should be visible
                cy.get('#quickSwitchHint', {timeout: TIMEOUTS.TWO_SEC}).should('be.visible').should('contain', 'Type to find a channel. Use UP/DOWN to browse, ENTER to select, ESC to dismiss.');
                cy.wait(TIMEOUTS.THREE_SEC);

                // # Type channel display name on Channel switcher input
                cy.findByRole('textbox', {name: 'quick switch input'}).type(publicChannel.display_name);
                cy.wait(TIMEOUTS.HALF_SEC);

                // * Should open up suggestion list for channels
                // * Should match each channel item and group label
                cy.get('#suggestionList').should('be.visible').children().within((el) => {
                    cy.wrap(el).should('contain', publicChannel.display_name);
                });

                // # Login as a admin and make channel private
                cy.apiAdminLogin();
                cy.apiPatchChannelPrivacy(publicChannel.id, 'P');

                // # Login as normal user
                cy.apiLogin(testUser);
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

                // # Open Find Channels
                cy.uiOpenFindChannels();

                // * Channel switcher hint should be visible
                cy.get('#quickSwitchHint', {timeout: TIMEOUTS.TWO_SEC}).should('be.visible').should('contain', 'Type to find a channel. Use UP/DOWN to browse, ENTER to select, ESC to dismiss.');
                cy.wait(TIMEOUTS.THREE_SEC);

                // # Type channel display name on Channel switcher input
                cy.findByRole('textbox', {name: 'quick switch input'}).type(publicChannel.display_name);
                cy.wait(TIMEOUTS.HALF_SEC);

                // * Should open up suggestion list for channels
                // * should no results after looking for channel
                cy.get('.no-results__title').should('be.visible').and('contain.text', 'No results for');
            });
        });

        it('MM-T2641 - Channel appears in More... under Public Channels before conversion but not after', () => {
            // # Create new test channel that is public
            cy.apiCreateChannel(
                testTeam.id,
                'a-channel-im-not-apart-off',
                'Public channel',
                'O',
            ).then(({channel: publicChannel}) => {
                cy.apiLogin(testUser);

                // # Visit off-topic channel
                cy.visit(`/${testTeam.name}/channels/off-topic`);

                // # Go to LHS and click 'Browse channels'
                cy.uiBrowseOrCreateChannel('Browse channels').click();

                // * Search public channel and ensure it appears in the list
                cy.get('#searchChannelsTextbox').type(publicChannel.display_name);
                cy.get('#moreChannelsList').should('include.text', publicChannel.display_name);

                // # login as a admin and revert to private channel
                cy.apiAdminLogin();
                cy.apiPatchChannelPrivacy(publicChannel.id, 'P');

                // # Login as a normal user
                cy.apiLogin(testUser);

                // # Visit off-topic channel
                cy.visit(`/${testTeam.name}/channels/off-topic`);

                // # Go to LHS and click 'Browse channels'
                cy.uiBrowseOrCreateChannel('Browse channels').click();

                // * Search private channel name and make sure it isn't there in public channel directory
                cy.get('#searchChannelsTextbox').type(publicChannel.display_name);
                cy.get('#moreChannelsList').should('include.text', 'No results for');
            });
        });

        it('MM-T2642 - Channel appears in Integrations options before conversion but not after', () => {
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Go to integrations
            cy.visit(`/${testTeam.name}/integrations`);

            // # Go to outgoing webhooks and then add out going web hooks page
            cy.get('#outgoingWebhooks', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();
            cy.get('#addOutgoingWebhook', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

            // * In the channel select options, ensure our display name appears
            cy.get('#channelSelect').children().should('contain.text', testChannel.display_name);

            // # Make channel private
            cy.apiPatchChannelPrivacy(testChannel.id, 'P');

            // # Go to integrations
            cy.visit(`/${testTeam.name}/integrations`);

            // # Go to outgoing webhooks and then add out going web hooks page
            cy.get('#outgoingWebhooks', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();
            cy.get('#addOutgoingWebhook', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();

            // * Ensure that our channel name doesn't appear in the list of options
            cy.get('#channelSelect').children().should('not.contain.text', testChannel.display_name);
        });
    });
});
