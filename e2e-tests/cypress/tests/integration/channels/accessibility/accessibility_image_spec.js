// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @accessibility

// * Verify the accessibility support in the different images

describe('Verify Accessibility Support in Different Images', () => {
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({offTopicUrl, user}) => {
            otherUser = user;

            // Visit the Off Topic channel
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T1508 Accessibility support in different images', () => {
        // * Verify image alt in profile image
        cy.get('#userAccountMenuButton').within(() => {
            cy.findByAltText('user profile image').should('be.visible');
        });

        // # Upload an image in the post
        cy.get('#fileUploadInput').attachFile('small-image.png');
        cy.postMessage('Image upload');

        // * Verify accessibility in images uploaded in a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#${postId}_message`).within(() => {
                cy.get('img').should('be.visible').should('have.attr', 'aria-label', 'file thumbnail small-image.png');
            });
        });

        // # Post a message as a different user
        cy.getCurrentChannelId().then((channelId) => {
            const message = `hello from ${otherUser.username}: ${Date.now()}`;
            cy.postMessageAs({sender: otherUser, message, channelId});
        });

        // # Open profile popover
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                cy.get('.status-wrapper').click();
            });

            // * Verify image alt in profile popover
            cy.get('.user-profile-popover').within(() => {
                cy.get('.Avatar').should('have.attr', 'alt', `${otherUser.username} profile image`);
            });
        });

        // # Close the profile popover
        cy.get('body').click();

        // # Open Settings > Display > Themes
        cy.uiOpenSettingsModal('Display').within(() => {
            cy.get('#displayButton').click();
            cy.get('#displaySettingsTitle').should('exist');
            cy.get('#themeTitle').scrollIntoView().should('be.visible');
            cy.get('#themeEdit').click();

            // * Verify image alt in Theme Images
            cy.get('#displaySettings').within(() => {
                cy.get('.appearance-section>div').children().each(($el) => {
                    cy.wrap($el).get('#denim-theme-icon').should('have.text', 'Denim theme icon');
                });
            });
        });
    });
});
