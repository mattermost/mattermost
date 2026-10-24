// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @status

// Note on coverage: this spec covers the parts of the manual online pin that are
// observable from the client. Two behaviours are deliberately left to the server tests in
// server/channels/app/platform/status_test.go, because both are driven by websocket hub
// events that cannot be triggered deterministically from here: that the pin survives the
// automatic away transition, and that it is cleared when the last connection goes away.

describe('Manually pinned online status', () => {
    let testUserId: string;

    beforeEach(() => {
        // # Login as a new test user and visit a channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel, user}) => {
            testUserId = user.id;
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('Selecting Online from the status menu pins the status as manual', () => {
        // # Set away first so the change to online is observable
        cy.uiGetSetStatusButton().click();
        cy.findByText('Away').click();
        verifyStatusIcon('away');

        // # Open the status menu and select Online
        cy.uiGetSetStatusButton().click();
        cy.findByText('Online').click();

        // * The status should be online
        verifyStatusIcon('online');

        // * The server should record the status as manual. This is the flag that stops the
        // automatic away transition from moving the user off online while they are idle.
        getStatus(testUserId).then((status) => {
            expect(status.status).to.equal('online');
            expect(status.manual).to.equal(true);
        });
    });

    it('An explicit away, dnd or offline choice still overrides a pinned online status', () => {
        // # Pin the status to online
        cy.uiGetSetStatusButton().click();
        cy.findByText('Online').click();
        verifyStatusIcon('online');

        // # Explicitly choose Away
        cy.uiGetSetStatusButton().click();
        cy.findByText('Away').click();

        // * An explicit choice always wins over the pin
        verifyStatusIcon('away');

        // # Pin back to online so the next step overrides a pin rather than an away status
        cy.uiGetSetStatusButton().click();
        cy.findByText('Online').click();
        verifyStatusIcon('online');

        // # Explicitly choose Do Not Disturb, which is a submenu of end times
        cy.uiGetSetStatusButton().click();
        cy.findByText('Do Not Disturb').trigger('mouseover');
        cy.get('.SubMenuItemContainer li#dndTime-dont_clear_menuitem').click();

        // * DND overrides the pin, and is itself stored as a manual status
        verifyStatusIcon('dnd');
        getStatus(testUserId).then((status) => {
            expect(status.status).to.equal('dnd');
            expect(status.manual).to.equal(true);
        });

        // # Pin back to online again
        cy.uiGetSetStatusButton().click();
        cy.findByText('Online').click();
        verifyStatusIcon('online');

        // # Explicitly choose Offline
        cy.uiGetSetStatusButton().click();
        cy.findByText('Offline').click();

        // * The status should be offline
        verifyStatusIcon('offline');

        // # Pin back to online
        cy.uiGetSetStatusButton().click();
        cy.findByText('Online').click();

        // * The pin can be re-applied after another status was chosen
        verifyStatusIcon('online');
        getStatus(testUserId).then((status) => {
            expect(status.manual).to.equal(true);
        });
    });

    it('The /online slash command pins the status as manual', () => {
        // # Set away first so the change to online is observable
        cy.postMessage('/away ');
        cy.findByText('You are now away').should('exist');
        verifyStatusIcon('away');

        // # Use the slash command to go back online
        cy.postMessage('/online ');
        cy.findByText('You are now online').should('exist');

        // * The slash command and the status menu should agree
        verifyStatusIcon('online');
        getStatus(testUserId).then((status) => {
            expect(status.status).to.equal('online');
            expect(status.manual).to.equal(true);
        });
    });
});

function getStatus(userId: string) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/status`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return response.body;
    });
}

function verifyStatusIcon(status: 'online' | 'away' | 'offline' | 'dnd') {
    cy.get('[aria-label="Status is \\"Online\\". Open user\'s account menu."]').
        should(status === 'online' ? 'exist' : 'not.exist');
    cy.get('[aria-label="Status is \\"Away\\". Open user\'s account menu."]').
        should(status === 'away' ? 'exist' : 'not.exist');
    cy.get('[aria-label="Status is \\"Offline\\". Open user\'s account menu."]').
        should(status === 'offline' ? 'exist' : 'not.exist');
    cy.get('[aria-label="Status is \\"Do not disturb\\". Open user\'s account menu."]').
        should(status === 'dnd' ? 'exist' : 'not.exist');
}
