// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @integrations @plugin @not_cloud

import {agendaPlugin} from '../../../utils/plugins';

describe('Integrations', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Login as test user and visit the newly created test channel
        cy.apiInitSetup().then(({team, user, channel}) => {
            // # Upload and enable Agenda plugin required for test
            cy.apiUploadAndEnablePlugin(agendaPlugin);

            // # Login as regular user and visit test channel
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T2835 Slash command help stays visible for plugin', () => {
        // * Suggestion list is not visible
        cy.get('#suggestionList').should('not.exist').then(() => {
            // * Suggestion list is visible after typing "/agenda " with space character
            cy.findByTestId('post_textbox').type('/agenda ');
            cy.get('#suggestionList').should('be.visible');
        });
    });
});
