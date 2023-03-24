// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

describe('Collapsed Reply Threads', () => {
    let testTeam;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Create new channel and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            testTeam = team;
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
        });
    });

    it('MM-T4140 should be able to toggle CRT on/off', () => {
        // # Set CRT to off
        cy.uiChangeCRTDisplaySetting('OFF');

        // * Threads menu in sidebar should not be visible
        cy.get('.SidebarGlobalThreads').should('not.exist');

        // # Set CRT to on
        cy.uiChangeCRTDisplaySetting('ON');

        // * Threads menu in sidebar should be visible
        cy.get('.SidebarGlobalThreads').should('exist');

        // # Visit global threads
        cy.visit(`/${testTeam.name}/threads`);

        // * should see followed threads in H2 title
        cy.get('h2').should('have.text', 'Followed threads');
    });
});
