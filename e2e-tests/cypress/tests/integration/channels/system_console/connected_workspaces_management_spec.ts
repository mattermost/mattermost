// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @system_console

import timeouts from '../../../fixtures/timeouts';
import {getRandomId, stubClipboard} from '../../../utils';

describe('Connected Workspaces', () => {
    let testTeam: Cypress.Team;
    let testTeam2: Cypress.Team;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let testUser: Cypress.UserProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let admin: Cypress.UserProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let testChannel: Cypress.Channel;

    before(() => {
        cy.apiGetMe().then(({user: adminUser}) => {
            admin = adminUser;

            cy.apiCreateTeam('testing-team-2', 'Testing Team 2').then(({team}) => {
                testTeam2 = team;
            });

            cy.apiInitSetup().then(({team, user, channel}) => {
                testTeam = team;
                testUser = user;
                testChannel = channel;
            });
        });
    });

    it('configured', () => {
        cy.apiRequireLicenseForFeature('SharedChannels');

        // @ts-expect-error types update, need ConnectedWorkspacesSettings
        cy.apiGetConfig().then(({config: {ConnectedWorkspacesSettings}}) => {
            expect(ConnectedWorkspacesSettings.EnableSharedChannels).equal(true);
            expect(ConnectedWorkspacesSettings.EnableRemoteClusterService).equal(true);
        });
    });

    it('empty state', () => {
        cy.visit('/admin_console');

        cy.get("a[id='site_config/secure_connections']").click();

        cy.findByTestId('secureConnectionsSection').within(() => {
            cy.findByRole('heading', {name: 'Connected Workspaces'});
            cy.findByRole('heading', {name: 'Share channels'});
            cy.contains('Connecting with an external workspace allows you to share channels with them');
        });
    });

    describe('accept invitation lifecycle', () => {
        const orgDisplayName = 'Testing Org Name ' + getRandomId();

        before(() => {
            cy.visit('/admin_console/site_config/secure_connections');
        });

        it('accept - bad codes', () => {
            // # Open create menu
            cy.findAllByRole('button', {name: 'Add a connection'}).eq(1).click();

            // # Open accept dialog
            cy.findAllByRole('menuitem', {name: 'Accept an invitation'}).click();

            cy.findByRole('dialog', {name: 'Accept a connection invite'}).as('dialog');

            // * Verify dialog
            cy.get('@dialog').within(() => {
                cy.uiGetHeading('Accept a connection invite');

                // * Verify instructions
                cy.findByText('Accept a secure connection from another server');
                cy.findByText('Enter the encrypted invitation code shared to you by the admin of the server you are connecting with.');

                // * Verify accept disabled
                cy.uiGetButton('Accept').should('be.disabled');

                // # Enter org name
                cy.findByRole('textbox', {name: 'Organization name'}).type(orgDisplayName);

                // # Enter bad invitation code
                cy.findByRole('textbox', {name: 'Encrypted invitation code'}).type('abc123');

                // # Enter bad password
                cy.findByRole('textbox', {name: 'Password'}).type('123abc');

                // * Verify accept still disabled
                cy.uiGetButton('Accept').should('be.disabled');

                // # Select team
                cy.findByTestId('destination-team-input').click().
                    findByRole('textbox').type(`${testTeam2.display_name}{enter}`);

                // # Try accept
                cy.uiGetButton('Accept').click();

                // * Verify error shown
                cy.findByText('There was an error while accepting the invite.');

                // # Close dialog
                cy.uiGetButton('Cancel').click();
            });

            // * Verify dialog closed
            cy.get('@dialog').should('not.exist');
        });
    });

    describe('create new connection lifecycle', () => {
        const orgDisplayName = 'Testing Org Name ' + getRandomId();
        const orgDisplayName2 = 'new display name here ' + getRandomId();

        before(() => {
            cy.visit('/admin_console/site_config/secure_connections');
        });

        it('create', () => {
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
            cy.uiGetButton('Save').click();

            // * Verify page change
            cy.location('pathname').should('not.include', '/secure_connections/create');
        });

        it('created dialog', () => {
            // * Verify connection created dialog
            verifyInviteDialog('Connection created');
        });

        it('basic details', () => {
            // * Verify name
            cy.findByTestId('organization-name-input').
                should('not.be.focused').
                should('have.value', orgDisplayName);

            // * Verify team
            cy.findByTestId('destination-team-input').should('have.text', testTeam.display_name);

            // * Verify connection status label
            cy.findByText('Connection Pending');
        });

        it('shared channels - empty', () => {
            cy.findByTestId('shared_channels_section').within(() => {
                cy.findByRole('heading', {name: "You haven't shared any channels"});

                cy.findByText('Please add channels to start sharing');
            });
        });

        it('add channel', () => {
            cy.findByTestId('shared_channels_section').within(() => {
                // * Verify title
                cy.findByRole('heading', {name: 'Shared Channels'});

                // * Verify subtitle
                cy.findByText("A list of all the channels shared with your organization and channels you're sharing externally.");

                // # Open add channels dialog
                cy.uiGetButton('Add channels').click();
            });

            cy.findByRole('dialog', {name: 'Select channels'}).as('dialog');

            cy.get('@dialog').within(() => {
                // * Verify instructions
                cy.findByText('Please select a team and channels to share');

                cy.findByRole('textbox', {name: 'Search and add channels'}).
                    should('be.focused').
                    type(testChannel.display_name, {force: true}).
                    wait(timeouts.HALF_SEC).
                    type('{enter}');

                // # Share
                cy.uiGetButton('Share').click();

                // * Verify create modal closed
                cy.get('@dialog').should('not.exist');
            });
        });

        it('shared channels', () => {
            cy.findByTestId('shared_channels_section').within(() => {
                // * Verify tabs
                cy.findByRole('tab', {name: orgDisplayName});
                cy.findByRole('tab', {name: 'Your channels', selected: true});

                cy.findByRole('table').findAllByRole('row').as('rows');

                // * Verify table headers
                cy.get('@rows').first().within(() => {
                    cy.findByRole('columnheader', {name: 'Name'});
                    cy.findByRole('columnheader', {name: 'Current Team'});
                });

                // * Verify shared channel row
                cy.get('@rows').eq(1).as('sharedChannelRow').within(() => {
                    cy.findByRole('cell', {name: testChannel.display_name});
                    cy.findByRole('cell', {name: testTeam.display_name});
                });
            });
        });

        it('remove channel', () => {
            // # Prompt remove channel
            cy.findByRole('table').findAllByRole('row').eq(1).findByRole('button', {name: 'Remove'}).click();

            // * Verify channel remove prompt
            cy.findByRole('dialog', {name: 'Remove channel'}).as('dialog');

            cy.get('@dialog').within(() => {
                // * Verify heading
                cy.uiGetHeading('Remove channel');

                // * Verify instructions
                cy.findByText('The channel will be removed from this connection and will no longer be shared with it.');

                cy.uiGetButton('Remove').click();
            });

            // * Verify no channels shared
            cy.uiGetHeading("You haven't shared any channels");
        });

        it('change display name and destination team', () => {
            // * Verify no changes to save
            cy.uiGetButton('Save').should('be.disabled');

            // # Enter name
            cy.findByTestId('organization-name-input').
                focus().
                clear().
                type(orgDisplayName2);

            // # Select team
            cy.findByTestId('destination-team-input').click().
                findByRole('textbox').type(`${testTeam2.display_name}{enter}`);

            // # Save
            cy.uiGetButton('Save').click();

            // * Verify name
            cy.findByTestId('organization-name-input').
                should('have.value', orgDisplayName2);

            // * Verify team
            cy.findByTestId('destination-team-input').should('have.text', testTeam2.display_name);

            cy.wait(timeouts.ONE_SEC);
        });

        it('can go back', () => {
            // # Go back to list page
            cy.get('a.back').click();

            // * Verify back at list page
            cy.findByRole('heading', {name: 'Connected Workspaces'});
        });

        it('connection row - basics', () => {
            cy.findAllByRole('link', {name: orgDisplayName2}).as('row');

            // # Open connection detail
            cy.get('@row').click();

            // # Go back to list page
            cy.get('a.back').click();

            // * Verify connection status
            cy.get('@row').findByText('Connection Pending');

            // # Open menu, click edit
            cy.get('@row').findByRole('button', {name: `Connection options for ${orgDisplayName2}`}).click();
            cy.findByRole('menu').findByRole('menuitem', {name: 'Edit'}).click();

            // # Go back to list page
            cy.get('a.back').click();
        });

        it('connection row - generate invitation', () => {
            cy.findAllByRole('link', {name: orgDisplayName2}).as('row');

            // # Open menu
            cy.get('@row').findByRole('button', {name: `Connection options for ${orgDisplayName2}`}).click();

            // # Generate invite
            cy.findByRole('menu').findByRole('menuitem', {name: 'Generate invitation code'}).click();

            verifyInviteDialog('Invitation code');
        });

        it('connection row - delete connection', () => {
            cy.findAllByRole('link', {name: orgDisplayName2}).as('row');

            // # Open menu
            cy.get('@row').findByRole('button', {name: `Connection options for ${orgDisplayName2}`}).click();

            // # Prompt delete
            cy.findByRole('menu').findByRole('menuitem', {name: 'Delete'}).click();

            // * Verify delete dialog
            cy.findByRole('dialog', {name: 'Delete secure connection'}).as('dialog');
            cy.get('@dialog').within(() => {
                // * Verify heading
                cy.uiGetHeading('Delete secure connection');

                // # Delete
                cy.uiGetButton('Yes, delete').click();
            });

            // * Verify connection deleted
            cy.get('@row').should('not.exist');

            // * Verify dialog closed
            cy.get('@dialog').should('not.exist');
        });
    });
});

const verifyInviteDialog = (name: string) => {
    stubClipboard().as('clipboard');

    cy.findByRole('dialog', {name}).as('dialog').within(() => {
        // * Verify heading
        cy.uiGetHeading(name);

        // * Verify instructions
        cy.findByText('Please share the invitation code and password with the administrator of the server you want to connect with.');
        cy.findByText('Share these two separately to avoid a security compromise');
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
            click().
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
        cy.uiGetButton('Done').click();
    });

    // * Verify dialog closed
    cy.get('@dialog').should('not.exist');
};
