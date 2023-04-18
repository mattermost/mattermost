// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('New Channel modal with Boards enabled', () => {
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T5141 New Channel is created with an associated Board', () => {
        // # Create new channel with board
        const channelName = 'Test Channel With Board';
        cy.uiCreateChannel({
            prefix: 'channel-',
            isPrivate: false,
            purpose: '',
            name: channelName,
            createBoard: true,
        }).then(() => {
            // * Verify that new channel is in the sidebar and is active
            cy.url().should('include', `/${testTeam.name}/channels/test-channel`);
            cy.get('#channelHeaderTitle').should('contain', channelName);
            cy.get(`.SidebarChannel.active:contains(${channelName})`).should('be.visible');

            // * Verify the board is created - check the message sent
            cy.waitUntil(() => cy.getLastPost().then((el) => {
                const postedMessageEl = el.find('.post-message__text > p')[0];
                return Boolean(postedMessageEl && postedMessageEl.textContent.includes('created the board'));
            }));
        });
    });
});
