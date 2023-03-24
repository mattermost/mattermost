// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @accessibility

describe('Verify Accessibility Support in different Buttons', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);

            // # Post a message
            cy.postMessage('hello');
        });
    });

    it('MM-T1459 Accessibility Support in RHS expand and close icons', () => {
        cy.clickPostCommentIcon();
        cy.get('#rhsContainer').
            should('be.visible').
            within(() => {
                // * Verify accessibility support in Sidebar Expand and Shrink icon
                cy.get('button.sidebar--right__expand').
                    should('have.attr', 'aria-label', 'Expand').
                    within(() => {
                        cy.get('.icon-arrow-expand').should('have.attr', 'aria-label', 'Expand Sidebar Icon');
                        cy.get('.icon-arrow-collapse').should('have.attr', 'aria-label', 'Collapse Sidebar Icon');
                    });

                // * Verify accessibility support in Close icon
                cy.get('#rhsCloseButton').
                    should('have.attr', 'aria-label', 'Close').
                    within(() => {
                        cy.get('.icon-close').should('have.attr', 'aria-label', 'Close Sidebar Icon');
                    });

                // # Close the sidebar
                cy.get('#rhsCloseButton').click();
            });
    });

    it('MM-T1461 Accessibility Support in different buttons in Channel Header', () => {
        // # Ensure the focus is on the Toggle Favorites button
        cy.uiGetChannelFavoriteButton().
            focus().
            tab({shift: true}).
            tab();

        // * Verify accessibility support in Favorites button
        cy.uiGetChannelFavoriteButton().
            should('be.focused').
            and('have.attr', 'aria-label', 'add to favorites').
            click();

        // * Verify accessibility support if Channel is added to Favorites
        cy.uiGetChannelFavoriteButton().
            should('have.attr', 'aria-label', 'remove from favorites');

        // # Ensure the focus is on the Toggle Favorites button
        cy.uiGetChannelFavoriteButton().
            focus().
            tab({shift: true}).
            tab();

        // # Press tab until the focus is on the Pinned posts button
        cy.focused().tab().tab();

        // * Verify accessibility support in Pinned Posts button
        cy.uiGetChannelPinButton().
            should('be.focused').
            and('have.attr', 'aria-label', 'Pinned posts').
            tab().tab().tab().tab();
    });
});
