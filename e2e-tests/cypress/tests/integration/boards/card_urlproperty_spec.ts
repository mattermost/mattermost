// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @boards

describe('Card URL Property', () => {
    before(() => {
        // # Login as new user
        cy.apiInitSetup({loginAfter: true});
        cy.clearLocalStorage();
    });

    const url = 'https://mattermost.com';
    const changedURL = 'https://mattermost.com/blog';

    it('MM-T5396 Allows to create and edit URL property', () => {
        cy.visit('/boards');

        // Create new board
        cy.uiCreateNewBoard('Testing');

        // Add a new card
        cy.uiAddNewCard('Card');

        // Add URL property
        cy.log('**Add URL property**');
        cy.findByRole('button', {name: '+ Add a property'}).click();
        cy.findByRole('button', {name: 'URL'}).click();
        cy.findByRole('textbox', {name: 'URL'}).type('{enter}');

        // Enter URL
        cy.log('**Enter URL**');
        cy.findByPlaceholderText('Empty').type(`${url}{enter}`);

        // Check buttons
        cy.log('**Check link**');
        cy.get('.URLProperty').trigger('mouseover');

        cy.log('**Check buttons**');

        // Change URL
        cy.log('**Change URL**');

        cy.get('.URLProperty Button[title=\'Edit\']').click({force: true});
        cy.findByRole('textbox', {name: url}).clear().type(`${changedURL}{enter}`);
        cy.findByRole('link', {name: changedURL}).should('exist');

        // Close card dialog
        cy.log('**Close card dialog**');
        cy.findByRole('button', {name: 'Close dialog'}).click();
        cy.findByRole('dialog').should('not.exist');

        // Show URL property
        showURLProperty();

        // Copy URL to clipboard
        cy.log('**Copy URL to clipboard**');
        cy.document().then((doc) => cy.spy(doc, 'execCommand')).as('exec');
        cy.get('.URLProperty Button[title=\'Edit\']').should('not.exist');
        cy.get('.URLProperty Button[title=\'Copy\']').click({force: true});
        cy.findByText('Copied!').should('exist');
        cy.findByText('Copied!').should('not.exist');
        cy.get('@exec').should('have.been.calledOnceWith', 'copy');

        // Add table view
        addView('Table');

        // Check buttons
        cy.log('**Check buttons**');
        cy.get('.URLProperty Button[title=\'Edit\']').should('exist');
        cy.get('.URLProperty Button[title=\'Copy\']').should('exist');
        cy.findByRole('button', {name: 'Copy'}).should('not.exist');

        // Add gallery view
        addView('Gallery');
        showURLProperty();

        // Check buttons
        cy.log('**Check buttons**');
        cy.get('.URLProperty Button[title=\'Edit\']').should('not.exist');
        cy.get('.URLProperty Button[title=\'Copy\']').should('exist');

        // Add calendar view
        addView('Calendar');
        showURLProperty();

        // Check buttons
        cy.log('**Check buttons**');
        cy.get('.URLProperty Button[title=\'Edit\']').should('not.exist');
        cy.get('.URLProperty Button[title=\'Copy\']').should('exist');
    });

    type ViewType = 'Board' | 'Table' | 'Gallery' | 'Calendar'

    const addView = (type: ViewType) => {
        cy.log(`**Add ${type} view**`);

        cy.findByRole('button', {name: 'View menu'}).click();
        cy.findByText('Add view').trigger('mouseover');
        cy.findByRole('button', {name: type}).click();
        cy.findByRole('textbox', {name: `${type} view`}).should('exist');
    };

    const showURLProperty = () => {
        cy.log('**Show URL property**');
        cy.findByRole('button', {name: 'Properties'}).click();
        cy.findByRole('button', {name: 'URL'}).click();
        cy.findByRole('button', {name: 'Properties'}).click();
        cy.findByRole('link', {name: changedURL}).should('exist');
    };
});
