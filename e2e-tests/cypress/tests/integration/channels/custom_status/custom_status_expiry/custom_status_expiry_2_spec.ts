// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @custom_status

import dayjs from 'dayjs';

describe('MM-T4064 Status expiry visibility', () => {
    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
        });
    });
    const waitingTime = 60; //minutes
    let expiresAt = dayjs();
    const expiryTimeFormat = 'h:mm A';

    it('MM-T4064_6 should show expiry time in the tooltip of custom status emoji in the post header', () => {
        // # Open the user account menu
        cy.uiOpenUserMenu('Set custom status');

        // * Verify that the custom status modal opens
        cy.findByRole('dialog', {name: 'Set a status'}).should('exist').within(() => {
            // # Select a custom status from the suggestions
            cy.get('.statusSuggestion__row').first().click();

            // # Click on the Set Status button
            cy.findByText('Set Status').click();
        });

        // * Modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // # Setting the time at which the custom status should be expired
        // # Note that we need to be flexible around accepted values, as this calculation and the server-side one may differ slightly
        expiresAt = dayjs().add(waitingTime, 'minute');

        // # Post a message in the channel
        cy.postMessage('Hello World!');

        // # Get the last post
        cy.getLastPostId().then((postId) => {
            // # Hover on the custom status emoji present in the post header
            cy.get(`#post_${postId}`).find('.emoticon').should('exist').trigger('mouseenter');

            // * Custom status tooltip should be visible and contain the correct custom status expiry time
            cy.findByRole('tooltip').should('exist').and('contain.text', expiresAt.format(expiryTimeFormat));

            cy.get(`#post_${postId}`).find('.emoticon').trigger('mouseleave');
        });
    });

    it('MM-T4064_7 should show custom status expiry time in the user popover', () => {
        // # Click on the post header of the last post by the current user and open profile popover
        cy.get('.post.current--user .post__header .user-popover').first().click();
        cy.get('div.user-profile-popover').should('exist');

        // * Check if the profile popover contains custom status expiry time in the Status heading
        cy.get('div.user-profile-popover #user-popover-status .user-popover__subtitle time').should('have.text', expiresAt.format(expiryTimeFormat));
    });
});
