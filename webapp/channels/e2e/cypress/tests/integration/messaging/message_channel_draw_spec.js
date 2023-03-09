// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @not_cloud @messaging @plugin

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getRandomId} from '../../utils';
import {drawPlugin} from '../../utils/plugins';

describe('M17448 Does not post draft message', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Update config
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
            },
        });

        // # Upload and enable "Draw" plugin
        cy.apiUploadAndEnablePlugin(drawPlugin);

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('on successful upload via "Draw" plugin', () => {
        const draft = `Draft message ${getRandomId()}`;
        cy.uiGetPostTextBox().clear().type(draft);

        // # Open file upload options and select draw plugin
        cy.get('#fileUploadButton').click();
        cy.get('#fileUploadOptions').findByText('Draw').click();

        // * Upload a file and verify drafted message still exist in textbox
        cy.get('canvas').trigger('pointerdown').trigger('pointerup').click();
        cy.findByText('Upload').should('be.visible').click();
        cy.uiGetPostTextBox().
            wait(TIMEOUTS.HALF_SEC).
            should('have.text', draft);
    });

    it('on upload cancel via "Draw" plugin', () => {
        const draft = `Draft message ${getRandomId()}`;
        cy.uiGetPostTextBox().clear().type(draft);

        // # Open file upload options and select draw plugin
        cy.get('#fileUploadButton').click();
        cy.get('#fileUploadOptions').findByText('Draw').click();

        // * Cancel file upload process and verify drafted message still exist in textbox
        cy.findByText('Cancel').should('be.visible').click();
        cy.uiGetPostTextBox().
            wait(TIMEOUTS.HALF_SEC).
            should('have.text', draft);
    });

    it('on upload attempt via "Your Computer', () => {
        const draft = `Draft message ${getRandomId()}`;
        cy.uiGetPostTextBox().clear().type(draft);

        // # Open file upload options and select "Your Computer"
        cy.get('#fileUploadButton').click();
        cy.get('#fileUploadOptions').findByText('Your computer').click();

        // * Verify drafted message still exist in textbox
        cy.uiGetPostTextBox().wait(TIMEOUTS.HALF_SEC).
            should('have.text', draft);
    });
});
