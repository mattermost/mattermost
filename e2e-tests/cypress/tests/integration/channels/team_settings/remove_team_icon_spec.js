// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings

describe('Teams Settings', () => {
    let testTeam;

    before(() => {
        // # Update config
        cy.apiUpdateConfig({EmailSettings: {RequireEmailVerification: false}});

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T391 Remove team icon', () => {
        // # Open team settings dialog
        openTeamSettingsDialog();

        // # Upload a file on center view
        cy.findByTestId('uploadPicture').attachFile('mattermost-icon.png');

        // * Save
        cy.uiSave();

        // * Verify team icon
        cy.get('#teamIconImage').should('be.visible');
        cy.get('#teamIconInitial').should('not.exist');

        // # Close the team settings dialog
        cy.uiClose();

        // # Open the team settings dialog
        openTeamSettingsDialog();

        // # Click on 'Remove Image' button to remove the image
        cy.findByTestId('removeImageButton').should('be.visible').click();

        // # Close the modal
        cy.uiClose();

        // # Open the team settings dialog
        openTeamSettingsDialog();

        // * After removing the team icon initial team holder is visible but not team icon holder
        cy.get('#teamIconImage').should('not.exist');
        cy.get('#teamIconInitial').should('be.visible');
    });
});

function openTeamSettingsDialog() {
    // # Open team menu and click 'Team Settings'
    cy.uiOpenTeamMenu('Team settings');

    // * Verify the team settings dialog is open
    cy.get('#teamSettingsModalLabel').should('be.visible').and('contain', 'Team Settings');

    cy.get('.team-picture-section').within(() => {
        // * Verify the edit icon is visible
        cy.get('.icon-pencil-outline').should('be.visible');

        // # Click on edit button
        cy.get('.icon-pencil-outline').click();
    });
}
