// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @team_settings

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

        // * Verify the settings picture button is visible to click
        cy.findByTestId('inputSettingPictureButton').should('be.visible').click();

        // * Before uploading the picture the save button must be disabled
        cy.uiSaveButton().should('be.disabled');

        // # Upload a file on center view
        cy.findByTestId('uploadPicture').attachFile('mattermost-icon.png');

        // * Save then close
        cy.uiSaveAndClose();

        // * Verify team icon
        cy.get(`#${testTeam.name}TeamButton`).within(() => {
            cy.findByTestId('teamIconImage').should('be.visible');
            cy.findByTestId('teamIconInitial').should('not.exist');
        });

        // # Open the team settings dialog
        openTeamSettingsDialog();

        // # Click on 'X' icon to remove the image
        cy.findByTestId('removeSettingPicture').should('be.visible').click();

        // # Click on the cancel button
        cy.findByTestId('cancelSettingPicture').should('be.visible').click();

        // # Close the team settings dialog
        cy.uiClose();

        // * Verify the team icon image is visible and initial team holder is not visible
        cy.get(`#${testTeam.name}TeamButton`).within(() => {
            cy.findByTestId('teamIconImage').should('be.visible');
            cy.findByTestId('teamIconInitial').should('not.exist');
        });

        // # Open team settings dialog
        openTeamSettingsDialog();

        // # Click on 'X' icon to remove the image
        cy.findByTestId('removeSettingPicture').should('be.visible').click();

        // # Save and close the modal
        cy.uiSaveAndClose();

        // * After removing the team icon initial team holder is visible but not team icon holder
        cy.get(`#${testTeam.name}TeamButton`).within(() => {
            cy.findByTestId('teamIconImage').should('not.exist');
            cy.findByTestId('teamIconInitial').should('be.visible');
        });
    });
});

function openTeamSettingsDialog() {
    // # Open team menu and click 'Team Settings'
    cy.uiOpenTeamMenu('Team Settings');

    // * Verify the team settings dialog is open
    cy.get('#teamSettingsModalLabel').should('be.visible').and('contain', 'Team Settings');

    // * Verify the edit icon is visible
    cy.get('#team_iconEdit').should('be.visible');

    // # Click on edit button
    cy.get('#team_iconEdit').click();
}
