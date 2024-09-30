// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @system_console

import {stubClipboard} from '../../../utils';

describe('Connected Workspaces', () => {
    let testTeam: Cypress.Team;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let testUser: Cypress.UserProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let admin: Cypress.UserProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let testChannel: Cypress.Channel;

    before(() => {
        cy.apiGetMe().then(({user: adminUser}) => {
            admin = adminUser;

            cy.apiInitSetup().then(({team, user, channel}) => {
                testTeam = team;
                testUser = user;
                testChannel = channel;
            });
        });
    });

    it('empty state', () => {
        ensureConfig();

        cy.visit('/admin_console');

        cy.get("a[id='environment/secure_connections']").click();

        cy.findByTestId('secureConnectionsSection').within(() => {
            cy.findByRole('heading', {name: 'Connected Workspaces'});
            cy.findByRole('heading', {name: 'Share channels'});
            cy.contains('Connecting with an external workspace allows you to share channels with them');
        });
    });

    it('create a connection', () => {
        const orgDisplayName = 'Testing Org Name';

        ensureConfig();
        cy.visit('/admin_console/environment/secure_connections');

        stubClipboard().as('clipboard');

        // # Click create
        cy.findAllByRole('button', {name: 'Add a connection'}).first().click();
        cy.findAllByRole('menuitem', {name: 'Create a connection'}).click();

        // * Verify on create page
        cy.location('pathname').should('include', '/secure_connections/create');

        // * Verify name focused
        // # Enter name
        cy.findByTestId('organization-name-input').
            should('be.focused').
            type(orgDisplayName);

        // # Select team
        cy.findByTestId('destination-team-input').click().
            findByRole('textbox').type(`${testTeam.display_name}{enter}`);

        // # Save
        cy.findByTestId('saveSetting').click();

        // * Verify page change
        cy.location('pathname').should('not.include', '/secure_connections/create');

        // * Verify created dialog
        cy.findAllByRole('dialog', {name: 'Connection created'}).within(() => {
            cy.findByText('Share this code and password');

            cy.findByRole('group', {name: 'Encrypted invitation code'}).as('invite');
            cy.findByRole('group', {name: 'Password'}).as('password');

            // # Copy invite
            // * Verify copy button text
            cy.get('@invite').
                findByRole('button', {name: 'Copy'}).
                click().
                should('have.text', 'Copied');

            // * Verify invite copied to clipboard
            cy.get('@invite').
                findByRole('textbox').invoke('val').
                then((value) => {
                    cy.get('@clipboard').
                        its('contents').
                        should('contain', value);
                });

            // # Copy password
            // * Verify copy button text
            cy.get('@password').
                findByRole('button', {name: 'Copy'}).
                focus().click().
                should('have.text', 'Copied');

            // * Verify password copied to clipboard
            cy.get('@password').
                findByRole('textbox').invoke('val').
                then((value) => {
                    cy.get('@clipboard').
                        its('contents').
                        should('contain', value);
                });

            // # Close dialog
            cy.findByRole('button', {name: 'Done'}).click();
        });

        // * Verify create modal closed
        cy.findAllByRole('dialog', {name: 'Connection created'}).should('not.exist');

        // * Verify name
        cy.findByTestId('organization-name-input').
            should('not.be.focused').
            should('have.value', orgDisplayName);

        // * Verify team
        cy.findByTestId('destination-team-input').should('have.text', testTeam.display_name);

        // * Verify connection status label
        cy.findByText('Connection Pending');
    });
});

const ensureConfig = () => {
    cy.apiRequireLicenseForFeature('SharedChannels');

    // @ts-expect-error types update, need ConnectedWorkspacesSettings
    cy.apiGetConfig().then(({config: {ConnectedWorkspacesSettings}}) => {
        expect(ConnectedWorkspacesSettings.EnableSharedChannels).equal(true);
        expect(ConnectedWorkspacesSettings.EnableRemoteClusterService).equal(true);
    });
};
