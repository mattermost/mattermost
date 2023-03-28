// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

describe('Settings > Display > Message Display: Colorize username', () => {
    let testTeam;
    let firstUser;
    let otherUser;
    let testChannel;
    const colors = {};
    let defaultTextColor = '';

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup().then(({channel, user, team}) => {
            testTeam = team;
            firstUser = user;
            testChannel = channel;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                // # Add user to team and channel
                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);

                    // # Post some messages
                    cy.postMessageAs({
                        sender: otherUser,
                        message: 'Other message',
                        channelId: testChannel.id,
                    });
                    cy.postMessageAs({
                        sender: firstUser,
                        message: 'Test message',
                        channelId: testChannel.id,
                    });
                });
            });
        },
        );
    });

    beforeEach(() => {
        // # Visit related channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4984_1 Message Display: colorize usernames option should not exist in Standard mode', () => {
        // # Select 'Standard' option
        cy.uiChangeMessageDisplaySetting();

        // # Set the default text color
        cy.findByText(firstUser.username).then((elements) => {
            cy.window().then((win) => {
                defaultTextColor = win.getComputedStyle(elements[0]).color;
            });
        });

        // # Go to Settings modal - Display section - Message Display
        goToMessageDisplaySetting();

        // * Verify Colorize usernames option doesn't exist;
        cy.findByRole('checkbox', {
            name: 'Colorize usernames: Use colors to distinguish users in compact mode',
        }).should('not.exist');

        // # Save and close the modal
        cy.uiSaveAndClose();
    });

    it('MM-T4984_2 Message Display: colorize usernames option should exist in Compact mode and function as expected', () => {
        // # Select 'Compact' option
        cy.uiChangeMessageDisplaySetting('COMPACT');

        // # Go to Settings modal - Display section - Message Display
        goToMessageDisplaySetting();

        // * Verify Colorize usernames option exists and checked by default
        cy.findByRole('checkbox', {name: 'Colorize usernames: Use colors to distinguish users in compact mode'}).should('exist');
        cy.findByRole('checkbox', {name: 'Colorize usernames: Use colors to distinguish users in compact mode'}).should('be.checked');

        // # Save and close the modal
        cy.uiSaveAndClose();

        // # Save the color of the buttons
        cy.findByText(firstUser.username).then((elements) => {
            colors[firstUser.username] = elements[0].attributes.style.value;
        });
        cy.findByText(otherUser.username).then((elements) => {
            colors[otherUser.username] = elements[0].attributes.style.value;
        }).then(() => {
            // * Verify that colors are different
            expect(colors[firstUser.username]).to.not.equal(colors[otherUser.username]);
        });

        cy.reload();

        // * Verify that after reload colors are the same
        cy.findByText(firstUser.username).then((elements) => {
            cy.wrap(elements[0]).should('have.attr', 'style', colors[firstUser.username]);
        });
        cy.findByText(otherUser.username).then((elements) => {
            cy.wrap(elements[0]).should('have.attr', 'style', colors[otherUser.username]);
        });
    });

    it('MM-T4984_3 Message Display: disabling colorize should revert colors to normal color', () => {
        // # Select 'Compact' option
        cy.uiChangeMessageDisplaySetting('COMPACT');

        // # Go to Settings modal - Display section - Message Display
        goToMessageDisplaySetting();

        // # Verify Colorize usernames option exists and make it unchecked
        cy.findByRole('checkbox', {name: 'Colorize usernames: Use colors to distinguish users in compact mode'}).should('exist');
        cy.findByRole('checkbox', {name: 'Colorize usernames: Use colors to distinguish users in compact mode'}).uncheck().should('not.be.checked');

        // # Save and close the modal
        cy.uiSaveAndClose();

        // * Verify that colors are reverted to normal
        cy.findByText(firstUser.username).then((elements) => {
            cy.wrap(elements[0]).should('have.css', 'color', defaultTextColor);
        });
        cy.findByText(otherUser.username).then((elements) => {
            cy.wrap(elements[0]).should('have.css', 'color', defaultTextColor);
        });
    });
});

function goToMessageDisplaySetting() {
    // # Go to Settings modal - Display section - Message Display
    cy.uiOpenSettingsModal('Display').within(() => {
        cy.get('#displayButton').scrollIntoView().click();
        cy.get('#message_displayEdit').should('be.visible');
        cy.get('#message_displayEdit').click();
    });
}
