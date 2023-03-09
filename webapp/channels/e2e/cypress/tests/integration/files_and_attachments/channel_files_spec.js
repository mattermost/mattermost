// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @filesearch

import * as TIMEOUTS from '../../fixtures/timeouts';

import {interceptFileUpload, waitUntilUploadComplete} from './helpers';

describe('Channel files', () => {
    const wordFile = 'word-file.doc';
    const wordxFile = 'wordx-file.docx';
    const imageFile = 'jpg-image-file.jpg';

    before(() => {
        // # Create new team and new user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            interceptFileUpload();
        });
    });

    it('MM-T4418 Channel files search', () => {
        // # Ensure Direct Message is visible in LHS sidebar
        cy.uiGetLhsSection('DIRECT MESSAGES').should('be.visible');

        // # Post with word and image files
        [wordFile, wordxFile, imageFile].forEach((file) => {
            attachFile(file);
        });

        // # Click the channel files icon
        cy.uiGetChannelFileButton().click();

        // * Showed all files by default
        verifySearchResult([imageFile, wordxFile, wordFile]);

        // # Filter by option
        [
            {option: 'Documents', returnedFiles: [wordxFile, wordFile]},
            {option: 'Spreadsheets', returnedFiles: null},
            {option: 'Presentations', returnedFiles: null},
            {option: 'Code', returnedFiles: null},
            {option: 'Images', returnedFiles: [imageFile]},
            {option: 'Audio', returnedFiles: null},
            {option: 'Videos', returnedFiles: null},
        ].forEach(({option, returnedFiles}) => {
            filterSearchBy(option, returnedFiles);
        });
    });
});

function attachFile(file) {
    // # Post file to user
    cy.get('#advancedTextEditorCell').
        find('#fileUploadInput').
        attachFile(file);
    waitUntilUploadComplete();
    cy.get('.post-image__thumbnail').should('be.visible');
    cy.uiGetPostTextBox().clear().type('{enter}');
}

function filterSearchBy(option, returnedFiles) {
    // # Filter by option
    cy.uiOpenFileFilterMenu(option);

    // # Wait until the list is updated
    cy.wait(TIMEOUTS.ONE_SEC);

    verifySearchResult(returnedFiles);
}

function verifySearchResult(files) {
    if (files) {
        cy.get('#search-items-container').should('be.visible').within(() => {
            cy.get('.fileDataName').each((el, i) => {
                cy.wrap(el).should('have.text', files[i]);
            });
        });
    } else {
        cy.get('#search-items-container').findByText('No files found').should('be.visible');
    }
}
