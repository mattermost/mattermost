// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit the newly created test channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            // # Visit a test channel
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T188 - Inline markdown image that is a link, opens the link', () => {
        const linkUrl = 'https://www.google.com';
        const imageUrl = 'https://docs.mattermost.com/_images/icon-76x76.png';
        const label = 'Build Status';
        const baseUrl = Cypress.config('baseUrl');

        // # Post the provided Markdown text in the test channel
        cy.postMessage(`[![${label}](${imageUrl})](${linkUrl})`);

        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).find('a').then(($a) => {
                // * Check that the newly created post contains an a tag with the correct href link and target
                cy.wrap($a).
                    should('have.attr', 'href', linkUrl).
                    and('have.attr', 'target', '_blank');

                // * Check that the newly created post has an image
                cy.wrap($a).find('img').should('be.visible').
                    and('have.attr', 'src', `${baseUrl}/api/v4/image?url=${encodeURIComponent(imageUrl)}`).
                    and('have.attr', 'alt', label);

                // # Assign the value of the a tag href to the 'href' variable and assert the link is valid
                const href = $a.prop('href');
                cy.request(href).its('body').should('include', '</html>');
            });
        });
    });
});
