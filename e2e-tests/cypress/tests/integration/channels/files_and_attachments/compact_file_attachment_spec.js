// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @files_and_attachments

import {interceptFileUpload, waitUntilUploadComplete} from './helpers';

describe('MM-66620 Compact view: file attachment alignment', () => {
    before(() => {
        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('should vertically center the attachment icon and filename in compact display', () => {
        const filename = 'word-file.doc';

        // # Set display mode to compact
        cy.apiSaveMessageDisplayPreference('compact');

        // # Upload a non-image file so it renders as a file attachment bar
        interceptFileUpload();
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();

        // # Post the message
        cy.uiGetPostTextBox().clear().type('{enter}');

        // # Reload to apply compact display preference
        cy.reload();

        // # Get the last post and find the compact file attachment link
        cy.getLastPostId().then((postId) => {
            cy.get(`#${postId}_message`).within(() => {
                cy.get('a.post-image__name').should('be.visible').then(($el) => {
                    // * Verify the element uses flex layout for alignment
                    expect($el).to.have.css('display', 'flex');
                    expect($el).to.have.css('align-items', 'center');
                });

                // * Verify the attachment icon is present inside the link
                cy.get('a.post-image__name .icon').should('be.visible');

                // * Verify the filename text is present
                cy.get('a.post-image__name').should('contain.text', filename);
            });
        });
    });

    it('should use block display for file attachment name in standard display', () => {
        const filename = 'word-file.doc';

        // # Set display mode to standard
        cy.apiSaveMessageDisplayPreference('clean');

        // # Reload to apply standard display preference
        cy.reload();
        cy.uiGetPostTextBox().should('be.visible');

        // # Upload a non-image file so it renders as a file attachment bar
        interceptFileUpload();
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();

        // # Post the message
        cy.uiGetPostTextBox().clear().type('{enter}');

        // # Get the last post and find the standard file attachment name
        cy.getLastPostId().then((postId) => {
            cy.get(`#${postId}_message`).within(() => {
                cy.get('.post-image__name').should('be.visible').then(($el) => {
                    // * Verify the element uses block layout in standard display
                    expect($el).to.have.css('display', 'block');
                });

                // * Verify the filename text is present
                cy.get('.post-image__name').should('contain.text', filename);
            });
        });
    });
});
