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

describe('Profile popover', () => {
    before(() => {
        // # Set view port to mobile
        cy.viewport('iphone-6');

        // # Login as test user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);

            // # Post a new message to ensure there will be a post to click on
            cy.postMessage('Test message');
        });
    });

    it('MM-T145_1 Mobile view: View profile popover from profile pic (standard mode)', () => {
        // # Setting posts to standard mode
        cy.apiSaveMessageDisplayPreference();
        cy.getLastPostId().then((postId) => {
            // add wait time to ensure image is rendered and can be clicked
            cy.wait(TIMEOUTS.HALF_SEC);

            // # Click on user profile image
            cy.get(`#post_${postId}`).find('.profile-icon > img').click({force: true});

            // * Popover should have rendered to screen
            cy.get('#user-profile-popover').should('be.visible');
            cy.get('body').type('{esc}');
        });
    });

    it('MM-T145_2 Mobile view: View profile popover from profile pic (compact mode)', () => {
        // # Setting posts to compact mode
        cy.apiSaveMessageDisplayPreference('compact');
        cy.getLastPostId().then((postId) => {
            // # Click on username
            cy.get(`#post_${postId}`).find('.user-popover').click({force: true});

            // * Popover should have rendered to screen
            cy.get('#user-profile-popover').should('be.visible');
        });
    });
});
