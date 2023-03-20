// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @compliance_export

import {verifyExportedMessagesCount, editLastPost} from './helpers';

describe('Compliance Export', () => {
    let teamName;

    before(() => {
        cy.apiRequireLicenseForFeature('Compliance');

        cy.apiUpdateConfig({
            MessageExportSettings: {
                ExportFormat: 'csv',
                DownloadExportResults: true,
            },
        });

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);
            cy.apiInitSetup().then(({team}) => {
                teamName = team.name;
            });

            // # Go to compliance page, enable export and do initial export
            cy.uiGoToCompliancePage();
            cy.uiEnableComplianceExport();
            cy.uiExportCompliance();
        });
    });

    it('MM-T1177_1 - Compliance export should include updated posts after editing multiple times, exporting multiple times', () => {
        // # Visit town-square channel
        cy.visit(`/${teamName}/channels/town-square`);

        // # Post messages
        cy.postMessage('Testing one');
        cy.postMessage('Testing two');

        // # Edit last post
        editLastPost('This is Edit Post');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // * 3 messages should be exported
        verifyExportedMessagesCount('3');
    });

    it('MM-T1177_2 - Compliance export should include updated posts after editing multiple times, exporting multiple times', () => {
        // # Visit town-square channel
        cy.visit(`/${teamName}/channels/town-square`);

        // # Post a Message
        cy.postMessage('Testing');

        // # Edit last post
        editLastPost('This is Edit One');

        // # Post a Message
        cy.postMessage('This is Edit Two');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // * 3 messages should be exported
        verifyExportedMessagesCount('3');
    });

    it('MM-T1177_3 - Compliance export should include updated posts after editing multiple times, exporting multiple times', () => {
        // # Navigate to a team and post a message
        cy.visit(`/${teamName}/channels/town-square`);
        cy.postMessage('Testing');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // # Editing previously exported post
        cy.visit(`/${teamName}/channels/town-square`);
        editLastPost('This is Edit Three');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // * 2 messages should be exported
        verifyExportedMessagesCount('2');
    });

    it('MM-T1177_4 - Compliance export should include updated posts after editing multiple times, exporting multiple times', () => {
        // # Navigate to a team and post a Message
        cy.visit(`/${teamName}/channels/town-square`);
        cy.postMessage('Testing');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // # Editing previously exported post
        cy.visit(`/${teamName}/channels/town-square`);
        editLastPost('This is Edit Three');

        // # Post new message
        cy.postMessage('This is the post');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // * 3 messages should be exported
        verifyExportedMessagesCount('3');
    });

    it('MM-T1177_5 - Compliance export should include updated posts after editing multiple times, exporting multiple times', () => {
        // # Visit town-square channel
        cy.visit(`/${teamName}/channels/town-square`);

        // # Navigate to a team and post a message
        cy.postMessage('Testing');

        // # Editing previously exported post
        editLastPost('This is Edit Four');
        editLastPost('This is Edit Five');

        // # Go to compliance page and export
        cy.uiGoToCompliancePage();
        cy.uiExportCompliance();

        // * 3 messages should be exported
        verifyExportedMessagesCount('3');
    });
});
