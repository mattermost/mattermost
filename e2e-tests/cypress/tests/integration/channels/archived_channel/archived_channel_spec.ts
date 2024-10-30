// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel

import {getRandomId} from '../../../utils';

import {createArchivedChannel} from './helpers';

describe('Leave an archived channel', () => {
    let testTeam;
    let testChannel;
    const testArchivedMessage = `this is an archived post ${getRandomId()}`;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
        });
    });

    it('MM-T1672_1 User can close archived channel (1/2)', () => {
        // # Open a channel that's not the town square
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # repeat searching and navigating to the archived channel steps 3 times.
        [1, 2, 3].forEach((i) => {
            // * ensure we are not on an archived channel
            cy.get('#channelInfoModalLabel span.icon__archive').should('not.exist');

            // # Search for a post in an archived channel
            cy.uiGetSearchContainer().click();
            cy.uiGetSearchBox().first().clear().type(`${testArchivedMessage}{enter}`);

            // # Open the archived channel by selecting Jump from search results and then selecting the link to move to the most recent posts in the channel
            cy.uiGetSearchContainer().should('be.visible');

            cy.get('a.search-item__jump').first().click();

            cy.get(`#sidebarItem_${testChannel.name}`).should('be.visible');

            cy.url().should('satisfy', (testUrl) => {
                return testUrl.endsWith(`${testTeam.name}/channels/${testChannel.name}`); // wait for permalink to turn into channel url
            });

            if (i < 3) {
                // # Close an archived channel by clicking "Close Channel" button in the footer
                cy.get('#channelArchivedMessage button').click();
            } else {
                // # Click the header menu and select Archive Channel
                cy.uiOpenChannelMenu('Archive Channel');
            }

            // * The user is returned to the channel they were previously viewing and the archived channel is removed from the drawer
            cy.get(`#sidebarItem_${testChannel.name}`).should('not.exist');
            cy.url().should('include', `${testTeam.name}/channels/off-topic`);
        });
    });

    it('MM-T1672_2 User can close archived channel (2/2)', () => {
        // # Add text to channel you land on (after closing the archived channel via Close Channel button)
        // * Able to add test
        cy.postMessage('some text');
        cy.getLastPostId().then((postId) => {
            cy.get(`#${postId}_message`).should('be.visible');
        });
    });

    it('MM-T1678 Open an archived channel using CTRL/CMD+K', () => {
        // # Select CTRL/CMD+K (or ⌘+K) to open the channel switcher
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.typeCmdOrCtrl().type('K', {release: true});

        // # Start typing the name of a public or private channel on this team that has been archived
        cy.findByRole('textbox', {name: 'quick switch input'}).type(testChannel.display_name);

        // # Select an archived channel from the list
        cy.get('#suggestionList').should('be.visible');
        cy.findByTestId(testChannel.name).should('be.visible');
        cy.findByTestId(testChannel.name).click();

        // * Channel name visible in header
        cy.get('#channelHeaderTitle').should('contain', testChannel.display_name);

        // * Archived icon is visible in header
        cy.get('#channelHeaderInfo .icon-archive-outline').should('be.visible');

        // * Channel is listed In drawer
        cy.get(`#sidebarItem_${testChannel.name}`).should('be.visible');
        cy.get(`#sidebarItem_${testChannel.name} .icon-archive-outline`).should('be.visible');

        // * footer shows you are viewing an archived channel
        cy.get('#channelArchivedMessage').should('be.visible');
    });

    it('MM-T1679 Open an archived channel using jump from search results', () => {
        // # Create or locate post in an archived channel where the test user had permissions to edit channel details
        // generate a sufficiently large set of messages to make the toast appear
        const messageList = Array.from({length: 40}, (_, i) => `${i}. any - ${getRandomId()}`);
        createArchivedChannel({prefix: 'archived-search-for'}, messageList).then(({name}) => {
            // # Locate the post in a search
            cy.uiGetSearchContainer().click();
            cy.uiGetSearchBox().first().clear().type(`${messageList[1]}{enter}`);

            // # Click jump to open an archive post in permalink view
            cy.uiGetSearchContainer().should('be.visible');
            cy.get('a.search-item__jump').first().click();

            // * Archived channel is opened in permalink view
            cy.get('.post--highlight').should('be.visible');

            // # Click on You are viewing an archived channel.
            cy.get('.toast__jump').should('be.visible').click();

            // * Channel is listed In drawer
            // * Channel name visible in header
            cy.get(`#sidebarItem_${name}`).should('be.visible');
            cy.get(`#sidebarItem_${name} .icon-archive-outline`).should('be.visible');

            // * Archived icon is visible in header
            cy.get('#channelHeaderInfo .icon-archive-outline').should('be.visible');

            // * Footer shows "You are viewing an archived channel. New messages cannot be posted. Close Channel"
            cy.get('#channelArchivedMessage').should('be.visible');
        });
    });
});
