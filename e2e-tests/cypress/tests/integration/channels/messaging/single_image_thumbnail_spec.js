// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @smoke

import * as MESSAGES from '../../../fixtures/messages';

describe('Message', () => {
    before(() => {
        // # Create new team and new user and visit Town Square channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T1796 Standard view: Show single image thumbnail', () => {
        verifySingleImageThumbnail({mode: 'Standard'});
    });

    it('MM-T1797 Compact view: Show single image thumbnail', () => {
        verifySingleImageThumbnail({mode: 'Compact'});
    });
});

function verifySingleImageThumbnail({mode = null} = {}) {
    const displayMode = {
        Compact: 'compact',
        Standard: 'clean',
    };
    const filename = 'image-small-height.png';

    // # Set message display setting to compact
    cy.apiSaveMessageDisplayPreference(displayMode[mode]);

    // # Make a post with some text and a single image
    cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
    cy.get('.post-image__thumbnail').should('be.visible');

    cy.postMessage(MESSAGES.MEDIUM);

    cy.get('div.file__image').last().within(() => {
        // *  The name of the image should not show
        cy.contains('div', filename).should('not.exist');

        // * There are arrows to collapse the preview
        cy.get('img[src*="preview"]').should('be.visible');
        cy.findByLabelText('Toggle Embed Visibility').should('exist').and('have.attr', 'data-expanded', 'true').click({force: true});
        cy.findByLabelText('Toggle Embed Visibility').should('exist').and('have.attr', 'data-expanded', 'false');
        cy.get('img[src*="preview"]').should('not.exist');
    });
}
