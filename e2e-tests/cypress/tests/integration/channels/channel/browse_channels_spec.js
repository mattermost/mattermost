// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {createPrivateChannel} from '../enterprise/elasticsearch_autocomplete/helpers';

const channelType = {
    all: 'Channel Type: All',
    public: 'Channel Type: Public',
    archived: 'Channel Type: Archived',
};

describe('Channels', () => {
    let testUser;
    let otherUser;
    let testTeam;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });

            cy.apiLogin(testUser).then(() => {
                // # Create new test channel
                cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
                    testChannel = channel;
                });

                // # Go to town square
                cy.visit(`/${team.name}/channels/town-square`);
            });
        });
    });

    it('MM-19337 Verify UI of Browse channels modal with archived selection', () => {
        verifyBrowseChannelsModalWithArchivedSelection(false, testUser, testTeam);
        verifyBrowseChannelsModalWithArchivedSelection(true, testUser, testTeam);
    });

    it('MM-19337 Enable users to view archived channels', () => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as new user and go to "/"
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels').click();

        cy.get('#browseChannelsModal').should('be.visible').within(() => {
            // * Dropdown should be visible, defaulting to "All Channels"
            cy.get('#menuWrapper').should('be.visible').and('contain', channelType.all).wait(TIMEOUTS.HALF_SEC);

            cy.get('#searchChannelsTextbox').should('be.visible').type(testChannel.display_name).wait(TIMEOUTS.HALF_SEC);
            cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 1).within(() => {
                cy.findByText(testChannel.display_name).should('be.visible');
            });
            cy.get('#searchChannelsTextbox').clear();

            // * Channel test should be visible as a public channel in the list
            cy.get('#moreChannelsList').should('be.visible').within(() => {
                // # Click to join the channel
                cy.findByText(testChannel.display_name).scrollIntoView().should('be.visible').click();
            });
        });

        // # Verify that the modal is not closed
        cy.get('#browseChannelsModal').should('exist');
        cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

        // # Login as channel admin and go directly to the channel
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Click channel header to open channel menu
        cy.get('#channelHeaderTitle').should('contain', testChannel.display_name).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Archive the channel
            cy.findByText('Archive Channel').should('be.visible').click();
        });

        // * Verify that the delete/archive channel modal is opened
        cy.get('#deleteChannelModal').should('be.visible').within(() => {
            // # Confirm archive
            cy.findByText('Archive').should('be.visible').click();
        });

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels').click();

        cy.get('#browseChannelsModal').should('be.visible')
        
        // # CLick dropdown to open selection
        cy.get('#menuWrapper').should('be.visible').click();

        // # Click on archived channels item
        cy.findByText('Archived channels').should('be.visible').click();

        // * Menu text should be updated to reflect the selection
        cy.get('#menuWrapper').should('contain', channelType.archived);

        cy.get('#searchChannelsTextbox').should('be.visible').type(testChannel.display_name).wait(TIMEOUTS.HALF_SEC);
        cy.get('#moreChannelsList').children().should('have.length', 1).within(() => {
            cy.findByText(testChannel.display_name).should('be.visible');
        });
        cy.get('#searchChannelsTextbox').clear();

        // * Test channel should be visible as a archived channel in the list
        cy.get('#moreChannelsList').should('be.visible').within(() => {
            // # Click to view archived channel
            cy.findByText(testChannel.display_name).scrollIntoView().should('be.visible').click();
        });

        // * Assert that channel is archived and new messages can't be posted.
        cy.get('#channelArchivedMessage').should('contain', 'You are viewing an archived channel. New messages cannot be posted.');
        cy.uiGetPostTextBox({exist: false});

        // # Switch to another channel
        cy.get('#sidebarItem_town-square').click();

        // * Assert that archived channel doesn't show up in LHS list
        cy.get('#sidebar-left').should('not.contain', testChannel.display_name);
    });

    it('MM-19337 Increase channel member count when user joins a channel', () => {
        // # Login as new user and go to "/"
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        let newChannel;
        cy.apiCreateChannel(testTeam.id, 'channel-to-leave', 'Channel to leave').then(({channel}) => {
            newChannel = channel;
            cy.visit(`/${testTeam.name}/channels/${newChannel.name}`);

            // # Leave the channel
            cy.uiLeaveChannel();

            // * Verify that we've switched to Town Square
            cy.url().should('include', '/channels/town-square');
        });

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels').click();

        cy.get('#browseChannelsModal').should('be.visible').within(() => {
            // * Verify that channel has zero members
            cy.findByTestId(`channelMemberCount-${newChannel.name}`).should('be.visible').and('contain', 0);

            // # Click the channel row to join the channel
            cy.findByTestId(`ChannelRow-${newChannel.name}`).scrollIntoView().should('be.visible').click();

            // * Verify that channel has one member
            cy.findByTestId(`channelMemberCount-${newChannel.name}`).should('be.visible').and('contain', 1);
        });
    });

    it('MM-T1702 Search works when changing public/all options in the dropdown', () => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });
        let newChannel;
        let testArchivedChannel;
        let testPrivateArchivedChannel;

        cy.apiCreateTeam('team', 'Test NoMember').then(({team}) => {
            cy.apiCreateChannel(team.id, 'not-archived-channel', 'Not Archived Channel').then(({channel}) => {
                newChannel = channel;
                cy.visit(`/${team.name}/channels/${newChannel.name}`);

                // # Leave the channel
                cy.uiLeaveChannel();

                // * Verify that we've switched to Town Square
                cy.url().should('include', '/channels/town-square');
            });

            cy.apiCreateChannel(team.id, 'archived-channel', 'Archived Channel').then(({channel}) => {
                testArchivedChannel = channel;

                // # Visit the channel
                cy.visit(`/${team.name}/channels/${testArchivedChannel.name}`);

                // # Archive the channel
                cy.uiArchiveChannel();

                // # Leave the channel
                cy.uiLeaveChannel();

                // * Verify that we've switched to Town Square
                cy.url().should('include', '/channels/town-square');
            });

            createPrivateChannel(team.id).then((channel) => {
                testPrivateArchivedChannel = channel;

                // # Visit the channel
                cy.visit(`/${team.name}/channels/${testPrivateArchivedChannel.name}`);

                // # Archive the channel
                cy.uiArchiveChannel();
                cy.visit(`/${team.name}/channels/town-square`);
            });
        });

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels').click();

        // * Dropdown should be visible, defaulting to "All channels"
        cy.get('#menuWrapper').should('be.visible').within((el) => {
            cy.wrap(el).should('contain', channelType.all);
        });

        // * Users should be able to type and search
        cy.get('#searchChannelsTextbox').should('be.visible').type('iv').wait(TIMEOUTS.HALF_SEC);
        cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 2)
        cy.get('#moreChannelsList').should('be.visible').within(() => {
            cy.findByText(newChannel.display_name).should('be.visible');
        });

        cy.get('#browseChannelsModal').should('be.visible')
        
        // * Users should be able to switch to "Archived Channels" list
        cy.get('#menuWrapper').should('be.visible').and('contain', channelType.all).click().wait(TIMEOUTS.HALF_SEC);
        
        // # Click on archived channels item
        cy.findByText('Archived channels').should('be.visible').click();

        // * Modal menu should be updated accordingly
        cy.get('#menuWrapper').should('contain', channelType.archived);
        
        cy.get('#searchChannelsTextbox').clear();
        cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 2);
        cy.get('#moreChannelsList').within(() => {
            cy.findByText(testArchivedChannel.display_name).should('be.visible');
            cy.findByText(testPrivateArchivedChannel.display_name).should('be.visible');
        });
});
});

function verifyBrowseChannelsModalWithArchivedSelection(isEnabled, testUser, testTeam) {
    // # Login as sysadmin and Update config to enable/disable viewing of archived channels
    cy.apiAdminLogin();
    cy.apiUpdateConfig({
        TeamSettings: {
            ExperimentalViewArchivedChannels: isEnabled,
        },
    });

    // * Verify browse channels modal
    cy.visit(`/${testTeam.name}/channels/town-square`);
    verifyBrowseChannelsModal(isEnabled);

    // # Login as regular user and verify browse channels modal
    cy.apiLogin(testUser);
    cy.visit(`/${testTeam.name}/channels/town-square`);
    verifyBrowseChannelsModal(isEnabled);
}

function verifyBrowseChannelsModal(isEnabled) {
    // # Go to LHS and click 'Browse channels'
    cy.uiBrowseOrCreateChannel('Browse channels').click();

    // * Verify that the browse channels modal is open and with or without option to view archived channels
    cy.get('#browseChannelsModal').should('be.visible').within(() => {
        if (isEnabled) {
            cy.get('#menuWrapper').should('be.visible').and('have.text', channelType.all);
        } else {
            cy.get('#menuWrapper').click();
            cy.findByText('Archived channels').should('not.exist');
        }
    });
}
