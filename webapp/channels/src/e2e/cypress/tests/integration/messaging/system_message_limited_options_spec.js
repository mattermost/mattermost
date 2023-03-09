// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Messaging', () => {
    let townsquareLink;
    let otherUser;

    before(() => {
        // # Visit town-square
        cy.apiInitSetup().then(({team, user}) => {
            otherUser = user;
            townsquareLink = `/${team.name}/channels/town-square`;
            cy.visit(townsquareLink);
        });
    });

    it('MM-T213 System message limited options', () => {
        // # Update channel header to create a new system message
        cy.updateChannelHeader(Date.now());

        // # Get system message Id
        cy.getLastPostId().then((lastPostId) => {
            // # Mouse over the post to show the options
            cy.get(`#post_${lastPostId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC);

            // * No option to reply this post
            cy.get(`#CENTER_commentIcon_${lastPostId}`).should('not.exist');

            // * No option to react to this post
            cy.get(`#CENTER_reaction_${lastPostId}`).should('not.exist');

            // # Click in the '...' button
            cy.get(`#CENTER_button_${lastPostId}`).click({force: true});
            cy.wait(TIMEOUTS.HALF_SEC);

            // # Get all list elements in the dropdown
            cy.get(`#CENTER_dropdown_${lastPostId}`).find('li').then((items) => {
                // * Must be only 1 element
                expect(items.length).to.equal(1);

                // * The element must be delete
                expect(items[0].id).to.equal(`delete_post_${lastPostId}`);
            });

            // # Log-in as a different user
            cy.apiLogin(otherUser);
            cy.visit(townsquareLink);

            // # Mouse over the post to show the options
            cy.get(`#post_${lastPostId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.THREE_SEC);

            // * No option should appear
            cy.get(`#CENTER_commentIcon_${lastPostId}`).should('not.exist');
            cy.get(`#CENTER_reaction_${lastPostId}`).should('not.exist');
            cy.get(`#CENTER_button_${lastPostId}`).should('not.exist');
        });
    });
});
