// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @search

describe('Search', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T4945_1 - Search bar popup should be visible when focus changes to one of its buttons', () => {
        //# clicks on the search box
        cy.uiGetSearchBox().click();

        //* search bar popup should be visibl
        cy.get('#searchbar-help-popup').should('be.visible');

        //# moves the focus to the next button (in this case Messages)
        cy.focused().tab();

        //* search bar popup should be visible
        cy.get('#searchbar-help-popup').should('be.visible');
    });

    it('MM-T4945_2 - Search bar popup should be hidden when focus is out of search bar items', () => {
        //# clicks on the search box
        cy.uiGetSearchBox().click();

        //* search bar popup should be visibl
        cy.get('#searchbar-help-popup').should('be.visible');

        //# press tab three times to move focus out of the search bar componment
        cy.focused().tab();
        cy.focused().tab();
        cy.focused().tab();

        //* now the popup should be closed
        cy.get('#searchbar-help-popup').should('not.be.visible');
    });

    it('MM-T4945_3 - Search bar popup should be open when focus back to search box', () => {
        //# clicks on the search box
        cy.uiGetSearchBox().click();

        //* search bar popup should be visibl
        cy.get('#searchbar-help-popup').should('be.visible');

        //# moves the focus to the next button (in this case Messages)
        cy.focused().tab();

        //* search bar popup should be visible
        cy.get('#searchbar-help-popup').should('be.visible');

        //# moves the focus back to the search box
        cy.focused().tab({shift: true});

        //* search bar popup should still be visible
        cy.get('#searchbar-help-popup').should('be.visible');
    });
});
