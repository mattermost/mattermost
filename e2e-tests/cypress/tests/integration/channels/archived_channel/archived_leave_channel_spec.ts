// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getRandomId} from '../../../utils';

describe('Leave an archived channel', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as test user and visit test channel
        cy.apiInitSetup({
            loginAfter: true,
            promoteNewUserAsAdmin: true,
        }).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser({prefix: 'second'}).then(({user: second}) => {
                cy.apiAddUserToTeam(testTeam.id, second.id);
                otherUser = second;
            });
        });
    });

    it('MM-T1670 Can view channel info for an archived channel', () => {
        cy.apiCreateArchivedChannel('archived-a', 'Archived A', 'O', testTeam.id).then((channel) => {
            // # Visit the archived channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Open channel menu and click View Info
            cy.uiOpenChannelMenu('View Info');

            // * Channel title is shown with archived icon
            cy.get('.sidebar--right__header i.icon-archive-outline').should('be.visible');
            cy.contains('.sidebar--right__header', `${channel.display_name}`).should('be.visible');

            // * Channel URL is listed (non-linked text)
            cy.url().then((loc) => {
                cy.contains('div[class^="ChannelLink"]', loc).should('be.visible');
            });
        });
    });

    it('MM-T1671 Can view members', () => {
        cy.apiCreateChannel(testTeam.id, 'archived-b', 'Archived B').then(({channel}) => {
            cy.apiAddUserToChannel(channel.id, otherUser.id);

            // # Archive the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            cy.uiArchiveChannel();

            // # Open channel menu and click View Members
            cy.uiOpenChannelMenu('View members');

            // * Channel Members modal opens
            cy.get('div#channelMembersModal').should('be.visible');

            // # Ensure there are no options to change channel roles or membership
            // * Membership or role cannot be changed
            cy.findAllByTestId('userListItemActions').eq(0).should('not.be.visible');
            cy.findAllByTestId('userListItemActions').eq(1).should('not.be.visible');

            // # Use search box to refine list of members
            // * Search box works as before to refine member list
            cy.get('#searchUsersInput').type(`${otherUser.first_name.substring(0, 5)}{enter}`);
            cy.findAllByTestId('userListItemDetails').should('have.length', 2);
        });
    });

    it('MM-T1673 Close channel after viewing two archived channels in a row', () => {
        // # Create an archived channel and post a message
        const messageC = 'archived channel C message';
        cy.apiCreateArchivedChannel('archived-c', 'Archived C', 'O', testTeam.id, [messageC], testUser).then((archivedChannelC) => {
            // # Create another archived channel and post a message
            const messageD = 'archived channel D message';
            cy.apiCreateArchivedChannel('archived-d', 'Archived D', 'O', testTeam.id, [messageD], testUser).then((archivedChannelD) => {
                // # Visit town-square and post a message
                const previousChannel = `/${testTeam.name}/channels/town-square`;
                cy.visit(previousChannel);

                // # Search for content from an archived channel
                cy.uiGetSearchContainer().click();
                cy.uiGetSearchBox().first().clear().type(`${messageD}{enter}`);

                // # Open the channel from search results
                cy.get('#searchContainer').should('be.visible');
                cy.get('#loadingSpinner').should('not.exist');

                // # Open the channel from search result by clicking Jump
                cy.get('#searchContainer').should('be.visible').findByText('Jump').click().wait(TIMEOUTS.ONE_SEC);
                cy.url().should('contain', `${testTeam.name}/channels/${archivedChannelD.name}`);

                // # Search for content from a different archived channel
                cy.uiGetSearchContainer().click();
                cy.uiGetSearchBox().first().clear().type(`${messageC}{enter}`);

                // # Open the channel from search result by clicking Jump
                cy.get('#searchContainer').should('be.visible').findByText('Jump').click().wait(TIMEOUTS.ONE_SEC);
                cy.url().should('contain', `${testTeam.name}/channels/${archivedChannelC.name}`);

                // # Select "Close Channel"
                cy.findByRole('button', {name: 'Close Channel'}).click();

                // * User is returned to previously viewed (non-archived) channel
                cy.url().should('include', previousChannel);
            });
        });
    });

    it('MM-T1674 CTRL/CMD+K list public archived channels you are a member of', () => {
        const commonName = `common${getRandomId()}`;
        cy.apiCreateChannel(testTeam.id, `${commonName}-a`, commonName).then(({channel}) => {
            // # Create a public channel then archived
            cy.apiCreateArchivedChannel(`${commonName}-b-archived`, `${commonName} Archived E`, 'O', testTeam.id, ['any message'], testUser).then((archivedChannel) => {
                cy.visit(`/${testTeam.name}/channels/off-topic`);

                // # Select CTRL/⌘+k) to open the channel switcher
                cy.typeCmdOrCtrl().type('K', {release: true});

                // # Start typing the name of a public channel on this team that has been archived which the test user belongs to
                cy.findByRole('textbox', {name: 'quick switch input'}).type(commonName);

                // * Suggestion list should be visible and have three elements (the two channels and the divider)
                cy.get('#suggestionList').should('be.visible').children().should('have.length', 3);

                // * Both active and archived public channels should be visible
                cy.findByTestId(channel.name).should('be.visible').find('.icon-globe').should('be.visible');
                cy.findByTestId(archivedChannel.name).should('be.visible').find('.icon-archive-outline').should('be.visible');
            });
        });
    });

    it('MM-T1675 CTRL/CMD+K list private archived channels you are a member of', () => {
        const commonName = `common${getRandomId()}`;
        cy.apiCreateChannel(testTeam.id, `${commonName}-a`, commonName).then(({channel}) => {
            // # Create a private channel then archived
            cy.apiCreateArchivedChannel(`${commonName}-b-archived`, `${commonName} Archived F`, 'P', testTeam.id, ['any message'], testUser).then((archivedChannel) => {
                cy.visit(`/${testTeam.name}/channels/off-topic`);

                // # Select CTRL/⌘+k) to open the channel switcher
                cy.typeCmdOrCtrl().type('K', {release: true});

                // # Start typing the name of a private channel on this team that has been archived which the test user belongs to
                cy.findByRole('textbox', {name: 'quick switch input'}).type(commonName);

                // * Suggestion list should be visible and have three elements (the two channels and the divider)
                cy.get('#suggestionList').should('be.visible').children().should('have.length', 3);

                // * Both active public and archived private channels should be visible
                cy.findByTestId(channel.name).should('be.visible').find('.icon-globe').should('be.visible');
                cy.findByTestId(archivedChannel.name).should('be.visible').find('.icon-archive-outline').should('be.visible');
            });
        });
    });

    it('MM-T1676 CTRL/CMD+K does not show private archived channels you are not a member of', () => {
        // # As another user, create or locate a private channel that the test user is not a member of and archive the channel
        cy.apiLogin(otherUser);
        cy.apiCreateArchivedChannel('archived-g', 'Archived G', 'O', testTeam.id, ['any message'], testUser).then((archivedChannel) => {
            // # As the test user, select CTRL/CMD+K (or ⌘+k) to open the channel switcher
            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/off-topic`);
            cy.contains('#channelHeaderTitle', 'Off-Topic');
            cy.typeCmdOrCtrl().type('K', {release: true});

            // * Private archived channels you are not a member of are not available on channel switcher
            cy.contains('#suggestionList', archivedChannel.name).should('not.exist');
        });
    });
});
