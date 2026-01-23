// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @plugin

import {demoPlugin} from '../../../utils';

describe('Link tooltips', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Set plugin settings
        const newSettings = {
            PluginSettings: {
                Enable: true,
            },
            ServiceSettings: {
                EnableGifPicker: true,
            },
            FileSettings: {
                EnablePublicLink: true,
            },
        };

        cy.apiUpdateConfig(newSettings);

        // # Enable the demo-plugin
        cy.apiUploadAndEnablePlugin(demoPlugin);

        // # Open a channel and post www.test.com
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T3422 fade in and out with an animation', () => {
        const url = 'www.test.com';
        cy.postMessage(url);
        cy.uiWaitUntilMessagePostedIncludes(url);

        // # Hover over the plugin link
        cy.findByText(url).should('exist').focus();

        // * Check tooltip has appeared
        cy.findByText('This is a custom tooltip from the Demo Plugin').should('be.visible');

        // # Close the tooltip
        cy.get('body').type('{esc}');
    });
});
