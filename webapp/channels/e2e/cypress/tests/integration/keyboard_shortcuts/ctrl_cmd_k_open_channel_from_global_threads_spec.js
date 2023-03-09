// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @keyboard_shortcuts

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let testChannel;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel, user}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(testUser.id, 'on');
            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Visit channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4648 CTRL/CMD+K - Create thread, Open global threads and then from find channels switch channel using arrow keys and Enter', () => {
        // # Post first message as other user
        cy.postMessageAs({
            sender: otherUser,
            message: 'First post',
            channelId: testChannel.id,
        }).then(({id: rootId}) => {
            // # Click on post to open RHS
            cy.get(`#post_${rootId}`).click();

            // # Post a reply as current user
            cy.postMessageReplyInRHS('Reply!');

            // # Close RHS
            cy.uiCloseRHS();
        });

        // # Post second message as other user
        cy.postMessageAs({
            sender: otherUser,
            message: 'Second post',
            channelId: testChannel.id,
        }).then(({id: rootId}) => {
            // # Click on post to open RHS
            cy.get(`#post_${rootId}`).click();

            // # Post a reply as current user
            cy.postMessageReplyInRHS('Reply!');

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * There should be a thread there
            cy.get('article.ThreadItem').should('have.have.lengthOf', 2);
        });

        // # Press CTRL/CMD+K
        cy.get('body').cmdOrCtrlShortcut('K');
        cy.get('#quickSwitchInput').type('T');

        // # Press down arrow
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{downarrow}');
        cy.get('body').type('{downarrow}');
        cy.get('body').type('{downarrow}');

        // * should not select thread and switch thread in background
        cy.url().should('equal', `${Cypress.config('baseUrl')}/${testTeam.name}/threads`);

        // * Confirm the offtopic channel is selected in the suggestion list
        cy.get('#suggestionList').findByTestId('off-topic').should('be.visible').and('have.class', 'suggestion--selected');

        // # Press up arrow
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{uparrow}');

        // * should not select thread and switch thread in background
        cy.url().should('equal', `${Cypress.config('baseUrl')}/${testTeam.name}/threads`);

        // * Confirm the townsquare channel is selected in the suggestion list
        cy.get('#suggestionList').findByTestId('town-square').should('be.visible').and('have.class', 'suggestion--selected');

        // # Press down arrow
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{downarrow}');

        // * should not select thread and switch thread in background
        cy.url().should('equal', `${Cypress.config('baseUrl')}/${testTeam.name}/threads`);

        // * Confirm the offtopic channel is selected in the suggestion list
        cy.get('#suggestionList').findByTestId('off-topic').should('be.visible').and('have.class', 'suggestion--selected');

        // # Press ENTER
        cy.get('body').type('{enter}');

        // * Confirm that channel is open
        cy.contains('#channelHeaderTitle', 'Off-Topic');
        cy.url().should('include', '/channels/off-topic');
    });
});
