// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Keyboard Shortcuts', () => {
    let teamName;
    let firstChannel;
    let secondChannel;
    const searchPrefix = 't1243';

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            teamName = team.name;

            // Unique prefix so arrow-key selection is not affected by other T* users/channels.
            cy.apiCreateChannel(team.id, `${searchPrefix}-a`, 'T1243A').then(({channel}) => {
                firstChannel = channel;
            });
            cy.apiCreateChannel(team.id, `${searchPrefix}-b`, 'T1243B').then(({channel}) => {
                secondChannel = channel;
            });
        });
    });

    beforeEach(() => {
        // Recency ranks the first channel first; a fresh visit also avoids a leftover overlay on retry.
        cy.visit(`/${teamName}/channels/${firstChannel.name}`);
    });

    it('MM-T1243 CTRL/CMD+K - Open public channel using arrow keys and Enter, click out of current channel message box first', () => {
        // # To remove focus from message text box
        cy.get('#postListContent').click();
        cy.uiGetPostTextBox().should('not.be.focused');

        // # Press CTRL/CMD+K
        cy.get('body').cmdOrCtrlShortcut('K');
        cy.get('#quickSwitchInput').type(searchPrefix);
        cy.wait(TIMEOUTS.HALF_SEC);

        // * Confirm the first matching public channel is selected
        cy.get('#suggestionList').findByTestId(firstChannel.name).should('be.visible').and('have.class', 'suggestion--selected');

        // # Press down arrow
        cy.get('body').type('{downarrow}');

        // * Confirm the second matching public channel is selected
        cy.get('#suggestionList').findByTestId(secondChannel.name).should('be.visible').and('have.class', 'suggestion--selected');

        // # Press ENTER
        cy.get('body').type('{enter}');

        // * Confirm that channel is open, and post text box has focus
        cy.contains('#channelHeaderTitle', secondChannel.display_name);
        cy.uiGetPostTextBox().should('be.focused');
    });
});
