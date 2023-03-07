// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import {verifySavedPost} from '../../support/ui/post';

describe('Post PreHeader', () => {
    let testTeam;

    before(() => {
        // # Login as test user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            testTeam = team;

            cy.visit(`/${testTeam.name}/channels/off-topic`);
        });
    });

    it('MM-T3352 Properly handle Saved Posts', () => {
        const message = 'test for saved post';

        // # Post a message
        cy.postMessage(message);

        cy.getLastPostId().then((postId) => {
            // * Check that the post pre-header is not visible
            cy.get('div.post-pre-header').should('not.exist');

            // # Click the center save icon of the post
            cy.clickPostSaveIcon(postId);

            // * Assert the preHeader is displayed and works as expected
            verifySavedPost(postId, message);

            // # Click again the center save icon of a post
            cy.clickPostSaveIcon(postId);

            // * Check that the post pre-header is not visible
            cy.get('div.post-pre-header').should('not.exist');

            // * Check that the post is not highlighted
            cy.get(`#post_${postId}`).should('not.have.class', 'post--pinned-or-flagged');
        });
    });

    it('MM-T3353 Unpinning and pinning a post removes and adds badge', () => {
        // # Post a message
        cy.postMessage('test for pinning/unpinning a post');

        cy.getLastPostId().then((postId) => {
            // * Check that the post pre-header is not visible
            cy.get('div.post-pre-header').should('not.exist');

            // # Pin the post.
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // * Check that the post is highlighted
            cy.get(`#post_${postId}`).
                should('have.class', 'post--pinned-or-flagged').
                within(() => {
                    // * Check that the post pre-header is visible
                    cy.get('div.post-pre-header').should('be.visible');

                    // * Check that the post pre-header has the pinned icon
                    cy.get('span.icon--post-pre-header.icon-pin').should('be.visible');

                    // * Check that the post pre-header has the pinned post link
                    cy.get('div.post-pre-header__text-container').
                        should('be.visible').
                        and('have.text', 'Pinned').
                        within(() => {
                            cy.get('a').as('pinnedLink').should('be.visible');
                        });
                });

            // * Check that the pinned posts list is not open in RHS before clicking the link in the post pre-header
            cy.get('#searchContainer').should('not.exist');

            // # Click the link
            cy.get('@pinnedLink').click();

            // * Check that the pinned posts list is open in RHS
            cy.get('#searchContainer').should('be.visible').within(() => {
                cy.get('.sidebar--right__title').
                    should('be.visible').
                    and('contain', 'Pinned Posts').
                    and('contain', 'Off-Topic');

                // * Check that the post pre-header is not shown for the pinned message in RHS
                cy.findByTestId('search-item-container').within(() => {
                    cy.get('div.post__content').should('be.visible');
                    cy.get(`#rhsPostMessageText_${postId}`).contains('test for pinning/unpinning a post');
                    cy.get('div.post-pre-header').should('not.exist');
                });
            });

            // # Close the RHS
            cy.get('#searchResultsCloseButton').should('be.visible').click();

            // # Unpin the post
            cy.uiClickPostDropdownMenu(postId, 'Unpin from Channel');

            // * Check that the post pre-header is not visible
            cy.get('div.post-pre-header').should('not.exist');

            // * Check that the post is not highlighted
            cy.get(`#post_${postId}`).should('not.have.class', 'post--pinned-or-flagged');
        });
    });

    it('MM-T3354 Handle posts that are both pinned and saved', () => {
        // # Post a message
        cy.postMessage('test both pinned and saved');

        cy.getLastPostId().then((postId) => {
            // # Pin the post.
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Save the post
            cy.clickPostSaveIcon(postId);

            // * Check that the post is highlighted
            cy.get(`#post_${postId}`).
                should('have.class', 'post--pinned-or-flagged').
                within(() => {
                    // * Check that the post pre-header is visible
                    cy.get('div.post-pre-header').should('be.visible');

                    // * Check that the post pre-header has the saved icon
                    cy.get('span.icon--post-pre-header').should('be.visible').
                        find('svg').should('have.attr', 'aria-label', 'Saved Icon');

                    // * Check that the post pre-header has the pinned icon
                    cy.get('span.icon--post-pre-header.icon-pin').should('be.visible');

                    // * Check that the post pre-header has both the saved and pinned links
                    cy.get('div.post-pre-header__text-container').
                        should('be.visible').
                        and('have.text', `Pinned${'\u2B24'}Saved`).
                        within(() => {
                            cy.get('a').should('have.length', 2);
                            cy.get('a').first().as('pinnedLink').should('be.visible');
                            cy.get('a').last().as('savedLink').should('be.visible');
                        });
                });

            // # Click the saved link
            cy.get('@savedLink').click();

            // * Check that the post pre-header only shows the pinned link in RHS
            cy.findByTestId('search-item-container').within(() => {
                cy.get('div.post-pre-header__text-container').
                    should('be.visible').
                    and('have.text', 'Pinned');
            });

            // # Click the pinned link
            cy.get('@pinnedLink').click();

            // * Check that the post pre-header only shows the saved link in RHS
            cy.findByTestId('search-item-container').within(() => {
                cy.get('div.post-pre-header__text-container').
                    should('be.visible').
                    and('have.text', 'Saved');
            });

            // # Search for the channel.
            cy.get('#searchBox').type('test both pinned and saved {enter}');

            // * Check that the post pre-header has both pinned and saved links in RHS search results
            cy.get('#searchContainer').should('be.visible').within(() => {
                cy.get('.sidebar--right__title').
                    should('be.visible').
                    and('have.text', 'Search Results');

                cy.findByTestId('search-item-container').within(() => {
                    cy.get('div.post-pre-header__text-container').
                        should('be.visible').
                        and('have.text', `Pinned${'\u2B24'}Saved`);
                });
            });
        });
    });
});
