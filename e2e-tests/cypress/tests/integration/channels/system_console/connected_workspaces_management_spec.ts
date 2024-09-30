// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @system_console

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
});

const ensureConfig = () => {
    cy.apiRequireLicenseForFeature('SharedChannels');

    // @ts-expect-error types update, need ConnectedWorkspacesSettings
    cy.apiGetConfig().then(({config: {ConnectedWorkspacesSettings}}) => {
        expect(ConnectedWorkspacesSettings.EnableSharedChannels).equal(true);
        expect(ConnectedWorkspacesSettings.EnableRemoteClusterService).equal(true);
    });
};
