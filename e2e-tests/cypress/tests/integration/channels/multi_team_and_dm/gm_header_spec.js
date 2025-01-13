// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

import {beRead, beUnread} from '../../../support/assertions';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Multi-user group header', () => {
    let testUser;
    let testTeam;
    const userIds = [];
    const userList = [];
    let groupChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            // # create a GM with at least 3 users
            ['charlie', 'diana', 'eddie'].forEach((name) => {
                cy.apiCreateUser({prefix: name, bypassTutorial: true}).then(({user: groupUser}) => {
                    cy.apiAddUserToTeam(testTeam.id, groupUser.id);
                    userIds.push(groupUser.id);
                    userList.push(groupUser);
                });
            });

            // # add test user to the list of group members
            userIds.push(testUser.id);

            cy.apiCreateGroupChannel(userIds).then(({channel}) => {
                groupChannel = channel;
            });
        });
    });

    it('MM-T472 Add a channel header to a GM', () => {
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${groupChannel.name}`);

        const header = 'peace and progress';

        // * Verify that no channel header is set
        cy.get('#channel-header').within(() => {
            cy.findByText('Add a channel header').should('not.be.visible');
        });

        // # Force click on button which is hidden and shows on hover
        cy.findByText('Add a channel header').click({force: true});

        // * Verify the modal open to add header
        cy.get('#editChannelHeaderModalLabel').should('be.visible').wait(TIMEOUTS.ONE_SEC);

        // # Add the header in the modal
        cy.findByPlaceholderText('Edit the Channel Header...').should('be.visible').type(`${header}{enter}`);

        // # Wait for modal to disappear
        cy.waitUntil(() => cy.get('#editChannelHeaderModalLabel').should('not.be.visible'));

        // * text appears in the top center panel
        cy.get('#channel-header').within(() => {
            cy.findByText(header).should('be.visible');
        });

        checkSystemMessage('updated the channel header');

        // * Channel is marked as read for the current user
        cy.get(`#sidebarItem_${groupChannel.name}`).should(beRead);

        // * Channel is marked as unread for other user
        cy.apiLogout();
        cy.apiLogin(userList[0]);
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.get(`#sidebarItem_${groupChannel.name}`).should(beUnread);
        cy.apiLogout();
    });

    it('MM-T473_1 Edit GM channel header', () => {
        // # open existing GM
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${groupChannel.name}`);

        // * Verify that channel header is set
        cy.get('#channel-header').within(() => {
            cy.findByText('Add a channel header').should('not.exist');
        });

        const header = 'In pursuit of peace and progress';
        editHeader(header);

        // * Header text appears at the top
        cy.get('#channel-header').within(() => {
            cy.findByText(header).should('be.visible');
        });

        checkSystemMessage('updated the channel header');

        // * Channel is marked as unread for other users
        cy.apiLogout();
        cy.apiLogin(userList[0]);
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.get(`#sidebarItem_${groupChannel.name}`).should(beUnread);
        cy.apiLogout();
    });

    it('MM-T473_2 Edit GM channel header', () => {
        // # Open existing GM
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${groupChannel.name}`);

        // * Verify that channel header is set
        cy.get('#channel-header').within(() => {
            cy.findByText('Add a channel header').should('not.exist');
        });

        const header = `In pursuit of peace and progress by @${testUser.username}`;
        editHeader(header);

        // * Header text appears at the top
        cy.get('#channel-header').within(() => {
            // * Verify mention is present
            cy.get('.mention-link').should('be.visible').and('have.text', `@${testUser.username}`);

            // * Verify its not highlighted
            cy.get('.mention--highlight').should('not.exist');
        });
    });

    function editHeader(header) {
        // # Click edit conversation header
        cy.uiOpenChannelMenu('Edit Conversation Header');

        // * Verify the modal open to add header
        cy.get('#editChannelHeaderModalLabel').should('be.visible').wait(TIMEOUTS.ONE_SEC);

        // # Add the header in the modal
        cy.get('textarea#edit_textbox').should('be.visible').clear().type(`${header}{enter}`);

        // # Wait for modal to disappear
        cy.waitUntil(() => cy.get('#editChannelHeaderModalLabel').should('not.be.visible'));
    }

    function checkSystemMessage(message) {
        // * system message is posted notifying of the change
        cy.getLastPostId().then((id) => {
            cy.get(`#postMessageText_${id}`).should('contain', message);
            cy.clickPostDotMenu(id).then(() => {
                // * system message can be deleted
                cy.get(`#delete_post_${id}`);
            });
        });
    }
});
