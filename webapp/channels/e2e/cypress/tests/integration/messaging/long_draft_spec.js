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
    let otherChannelName;
    let otherChannelUrl;
    let initialHeight = 0;

    before(() => {
        // # Make sure the viewport is the expected one, so written lines always create new lines
        cy.viewport(1000, 660);

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            otherChannelName = out.channel.name;
            otherChannelUrl = out.channelUrl;
            cy.visit(out.offTopicUrl);
            cy.postMessage('hello');

            cy.uiGetPostTextBox().invoke('height').then((height) => {
                initialHeight = height;

                // # Get the height before starting to write
                // Setting alias based on reference to element seemed to be problematic with Cypress (regression)
                // Quick hack to reference based on value
                cy.wrap(initialHeight).as('initialHeight');
                cy.wrap(initialHeight).as('previousHeight');
            });
        });
    });

    it('MM-T211 Leave a long draft in the main input box', () => {
        const lines = [
            'Lorem ipsum dolor sit amet,',
            'consectetur adipiscing elit.',
            'Nulla ac consectetur quam.',
            'Phasellus libero lorem,',
            'facilisis in purus sed, auctor.',
        ];

        // # Write all lines
        writeLinesToPostTextBox(lines);

        // # Visit a different channel and verify textbox
        cy.get(`#sidebarItem_${otherChannelName}`).click({force: true}).wait(TIMEOUTS.THREE_SEC);
        verifyPostTextbox('@initialHeight', '');

        // # Return to the channel and verify textbox
        cy.get('#sidebarItem_off-topic').click({force: true}).wait(TIMEOUTS.THREE_SEC);
        verifyPostTextbox('@previousHeight', lines.join('\n'));

        // # Clear the textbox
        cy.uiGetPostTextBox().clear();
        cy.postMessage('World!');

        // # Write all lines again
        cy.wrap(initialHeight).as('previousHeight');
        writeLinesToPostTextBox(lines);

        // # Visit a different channel by URL and verify textbox
        cy.visit(otherChannelUrl).wait(TIMEOUTS.THREE_SEC);
        verifyPostTextbox('@initialHeight', '');

        // # Should have returned to the channel by URL. However, Cypress is clearing storage for some reason.
        // # Does not happened on actual user interaction.
        // * Verify textbox
        cy.get('#sidebarItem_off-topic').click({force: true}).wait(TIMEOUTS.THREE_SEC);
        verifyPostTextbox('@previousHeight', lines.join('\n'));
    });
});

function writeLinesToPostTextBox(lines) {
    Cypress._.forEach(lines, (line, i) => {
        // # Add the text
        cy.uiGetPostTextBox().type(line, {delay: TIMEOUTS.ONE_HUNDRED_MILLIS}).wait(TIMEOUTS.HALF_SEC);

        if (i < lines.length - 1) {
            // # Add new line
            cy.uiGetPostTextBox().type('{shift}{enter}').wait(TIMEOUTS.HALF_SEC);

            // * Verify new height
            cy.uiGetPostTextBox().invoke('height').then((height) => {
                // * Verify previous height should be lower than the current height
                cy.get('@previousHeight').should('be.lessThan', parseInt(height, 10));

                // # Store the current height as the previous height for the next loop
                cy.wrap(parseInt(height, 10)).as('previousHeight');
            });
        }
    });
    cy.wait(TIMEOUTS.THREE_SEC);
}

function verifyPostTextbox(heightSelector, text) {
    cy.uiGetPostTextBox().and('have.text', text).invoke('height').then((currentHeight) => {
        cy.get(heightSelector).should('be.gte', currentHeight);
    });
}
