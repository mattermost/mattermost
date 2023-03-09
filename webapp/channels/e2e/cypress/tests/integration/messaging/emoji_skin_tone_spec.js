// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T3014 Skin tone emoji', () => {
        const gestures = [
            ':wave',
            ':point_up',
            ':clap',
            ':+1',
        ];

        const skinTones = [
            '_light_skin_tone:',
            '_medium_light_skin_tone:',
            '_medium_skin_tone:',
            '_medium_dark_skin_tone:',
            '_dark_skin_tone:',
        ];

        // # Post emojis and check if they are visible on desktop and mobile viewports
        gestures.forEach((gesture) => {
            skinTones.forEach((skinTone) => {
                // # Set viewport to desktop and post gesture with skin tone
                cy.viewport('macbook-13');
                cy.postMessage(gesture + skinTone);

                // * Check if gesture with skin tone is visible
                cy.findByTitle(gesture + skinTone).should('be.visible');

                // # Set viewport to mobile
                cy.viewport('iphone-se2');

                // * Check if gesture with skin tone is visible
                cy.findByTitle(gesture + skinTone).should('be.visible');
            });
        });
    });
});
