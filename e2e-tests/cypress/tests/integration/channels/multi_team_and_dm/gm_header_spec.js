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

        // * no channel header is set
        cy.contains('#channelHeaderDescription button span', 'Add a channel header').should('be.visible');

        // # click add a channel heander
        cy.findByRoleExtended('button', {name: 'Add a channel header'}).should('be.visible').click();

        // # type a header
        const header = 'this is a header!';
        cy.get('#editChannelHeaderModalLabel').should('be.visible').wait(TIMEOUTS.ONE_SEC);
        cy.get('textarea#edit_textbox').should('be.visible').type(`${header}{enter}`);
        cy.get('#editChannelHeaderModalLabel').should('not.exist'); // wait for modal to disappear

        // * text appears in the top center panel
        cy.contains('#channelHeaderDescription span.header-description__text p', header);

        checkSystemMessage('updated the channel header');

        // * channel is marked as read for the current user
        cy.get(`#sidebarItem_${groupChannel.name}`).should(beRead);

        // * channel is marked as unread for other user
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

        // * verify header is set
        cy.contains('#channelHeaderDescription button span', 'Add a channel header').should('not.exist');

        const header = 'this is a new header!';
        editHeader(header);

        // * text appears at the top
        cy.contains('#channelHeaderDescription span.header-description__text p', header);

        checkSystemMessage('updated the channel header');

        // * channel is marked as unread for other users
        cy.apiLogout();
        cy.apiLogin(userList[0]);
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.get(`#sidebarItem_${groupChannel.name}`).should(beUnread);
        cy.apiLogout();
    });

    it('MM-T473_2 Edit GM channel header', () => {
        // # open existing GM
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${groupChannel.name}`);

        // * verify header is set
        cy.contains('#channelHeaderDescription button span', 'Add a channel header').should('not.exist');

        const header = `Header by @${testUser.username}`;
        editHeader(header);

        cy.get('#channelHeaderDescription').find('.header-description__text').
            find('.mention-link').
            should('be.visible').and('have.text', `@${testUser.username}`);
        cy.get('#channelHeaderDescription').find('.header-description__text').
            find('.mention--highlight').
            should('not.exist');
    });

    const editHeader = (header) => {
        // # Click edit conversation header
        cy.uiOpenChannelMenu('Edit Conversation Header');

        // # type new header
        cy.get('#editChannelHeaderModalLabel').should('be.visible');
        cy.get('textarea#edit_textbox').should('be.visible').clear().type(`${header}{enter}`);
        cy.get('#editChannelHeaderModalLabel').should('not.exist'); // wait for modal to disappear
    };

    const checkSystemMessage = (message) => {
        // * system message is posted notifying of the change
        cy.getLastPostId().then((id) => {
            cy.get(`#postMessageText_${id}`).should('contain', message);
            cy.clickPostDotMenu(id).then(() => {
                // * system message can be deleted
                cy.get(`#delete_post_${id}`);
            });
        });
    };
});
