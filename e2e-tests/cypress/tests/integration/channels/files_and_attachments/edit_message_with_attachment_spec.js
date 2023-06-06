// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @files_and_attachments

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Edit Message with Attachment', () => {
    before(() => {
        // # Enable Link Previews
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        // # Create new team and new user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2268 - Edit Message with Attachment', () => {
        // # Upload file
        cy.get('#fileUploadInput').attachFile('mattermost-icon.png');

        // # Wait for file to upload
        cy.wait(TIMEOUTS.TWO_SEC);

        // # Post message
        cy.postMessage('Test');

        cy.getLastPost().within(() => {
            // * Posted message should be correct
            cy.get('.post-message__text').should('contain.text', 'Test');

            // * Attachment should exist
            cy.get('.file-view--single').should('exist');

            // * Edited indicator should not exist
            cy.get('.post-edited__indicator').should('not.exist');
        });

        // # Open the edit dialog
        cy.uiGetPostTextBox().type('{uparrow}');

        // # Add some more text and save
        cy.get('#edit_textbox').type(' with some edit');
        cy.get('#edit_textbox').type('{enter}').wait(TIMEOUTS.HALF_SEC);

        cy.getLastPost().within(() => {
            // * New text should show
            cy.get('.post-message__text').should('contain.text', 'Test with some edit');

            // * Attachment should still exist
            cy.get('.file-view--single').should('exist');

            // * Edited indicator should exist
            cy.get('.post-edited__indicator').should('exist');
        });
    });
});
