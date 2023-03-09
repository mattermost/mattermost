// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @system_console @compliance_export

import {
    downloadAndUnzipExportFile,
    verifyActianceXMLFile,
    verifyPostsCSVFile,
} from './helpers';

describe('Compliance Export', () => {
    const downloadsFolder = Cypress.config('downloadsFolder');

    let newTeam;
    let newChannel;
    let botId;
    let botName;

    before(() => {
        cy.apiRequireLicenseForFeature('Compliance');

        cy.apiUpdateConfig({
            MessageExportSettings: {
                ExportFormat: 'csv',
                DownloadExportResults: true,
            },
            ServiceSettings: {
                EnforceMultifactorAuthentication: false,
            },
        });

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);

            //# Create a test bot
            cy.apiCreateBot().then(({bot}) => {
                ({user_id: botId, display_name: botName} = bot);
                cy.apiPatchUserRoles(bot.user_id, ['system_admin', 'system_user']);
            });

            cy.apiInitSetup().then(({team, channel}) => {
                newTeam = team;
                newChannel = channel;

                // # Do initial export
                exportCompliance();
            });
        });
    });

    after(() => {
        cy.shellRm('-rf', downloadsFolder);
    });

    it('MM-T1175_1 - UserType identifies that the message is posted by a bot', () => {
        const message = `This is CSV bot message from ${botName} at ${Date.now()}`;

        // # Post bot message
        postBotMessage(newTeam, newChannel, botId, message);

        // # Go to Compliance page and run report
        exportCompliance();

        // # Download and Unzip exported file
        const targetFolder = `${downloadsFolder}/${Date.now().toString()}`;
        downloadAndUnzipExportFile(targetFolder);

        // * Export file should contain bot messages
        verifyPostsCSVFile(
            targetFolder,
            'have.string',
            `${message},message,bot`,
        );
    });

    it('MM-T1175_2 - UserType identifies that the message is posted by a bot', () => {
        const message = `This is XML bot message from ${botName} at ${Date.now()}`;

        // # Post bot message
        postBotMessage(newTeam, newChannel, botId, message);

        // # Go to Compliance and enable run export
        exportCompliance('Actiance XML');

        // # Download and Unzip exported File
        const targetFolder = `${downloadsFolder}/${Date.now().toString()}`;
        downloadAndUnzipExportFile(targetFolder);

        // * Export file should message from bot
        verifyActianceXMLFile(
            targetFolder,
            'have.string',
            message,
        );
        verifyActianceXMLFile(
            targetFolder,
            'have.string',
            '<UserType>bot</UserType>',
        );
    });
});

function postBotMessage(newTeam, newChannel, botId, message) {
    cy.apiCreateToken(botId).then(({token}) => {
        // # Logout to allow posting as bot
        cy.apiLogout();
        cy.apiCreatePost(newChannel.id, message, '', {attachments: [{pretext: 'Look some text', text: 'This is text'}]}, token);

        // # Re-login to validate post presence
        cy.apiAdminLogin();
        cy.visit(`/${newTeam.name}/channels/${newChannel.name}`);

        // * Validate post was created
        cy.findByText(message).should('be.visible');
    });
}

function exportCompliance(type) {
    cy.uiGoToCompliancePage();
    cy.uiEnableComplianceExport(type);
    cy.uiExportCompliance();
}
