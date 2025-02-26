// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > list', {testIsolation: true}, () => {
    const playbookTitle = 'The Playbook Name';
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            // # Login as user-1
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: playbookTitle,
                memberIDs: [],
            });

            // # Create an archived public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook archived',
                memberIDs: [],
            }).then(({id}) => cy.apiArchivePlaybook(id));
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('has "Playbooks" in heading', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // * Assert contents of heading.
        cy.findByTestId('titlePlaybook').should('exist').contains('Playbooks');
    });

    it('join/leave playbook', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on leave
        cy.findByText('Leave').click();

        // * Verify it has disappeared from the LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('not.exist');

        // # Join a playbook
        cy.findByTestId('join-playbook').click();

        // * Verify it has appeared in LHS
        cy.findByTestId('lhs-navigation').findByText(playbookTitle).should('exist');
    });

    it('can duplicate playbook', () => {
        // # Login as testUser2
        cy.apiLogin(testUser2);

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to Playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click on the dot menu
        cy.findByTestId('menuButtonActions').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByText('Copy of ' + playbookTitle).should('exist');

        // * Verify that the current user is a member and can run the playbook.
        cy.findByText('Copy of ' + playbookTitle).closest('[data-testid="playbook-item"]').within(() => {
            cy.findByTestId('run-playbook').should('exist');
            cy.findByTestId('join-playbook').should('not.exist');
        });

        // * Verify that the duplicated playbook is shown in the LHS
        cy.findByTestId('Playbooks').within(() => {
            cy.findByText('Copy of ' + playbookTitle).should('be.visible');
        });
    });

    context('archived playbooks', () => {
        it('does not show them by default', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Assert the archived playbook is not there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(2);
            });
        });
        it('shows them upon click on the filter', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Click the With Archived button
            cy.findByTestId('with-archived').click();

            // * Assert the archived playbook is there.
            cy.findAllByTestId('playbook-title').should((titles) => {
                expect(titles).to.have.length(3);
            });
        });
    });

    describe('can import playbook', () => {
        let validPlaybookExport;
        let invalidTypePlaybookExport;

        const bufferToCypressFile = (fileName, fileData, fileType) => ({
            fileName,
            contents: fileData,
            mimeType: fileType,
        });

        before(() => {
            // # Load fixtures and convert to File
            cy.fixture('playbook-export.json', null).then((buffer) => {
                validPlaybookExport = bufferToCypressFile('export.json', buffer, 'application/json');
            });
            cy.fixture('mp3-audio-file.mp3', null).then((buffer) => {
                invalidTypePlaybookExport = bufferToCypressFile('audio.mp3', buffer, 'audio/mpeg');
            });
        });

        it('triggered by drag and drop', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Drop loaded fixture onto playbook list
            cy.findByTestId('playbook-list-scroll-container').selectFile(validPlaybookExport, {
                action: 'drag-drop',
                force: true,
            });

            // * Verify that a new playbook was created.
            cy.findByTestId('playbook-editor-title').should('contain', 'Example Playbook');
        });

        it('triggered by using button/input', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Select loaded fixture for upload
                cy.findByTestId('playbook-import-input').selectFile(validPlaybookExport, {force: true});
            });

            // * Verify that a new playbook was created.
            cy.findByTestId('playbook-editor-title').should('contain', 'Example Playbook');
        });

        it('fails to import invalid file type', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to Playbooks
            cy.findByTestId('playbooksLHSButton').click();

            cy.findByTestId('titlePlaybook').within(() => {
                // # Select loaded fixture for upload
                cy.findByTestId('playbook-import-input').selectFile(invalidTypePlaybookExport, {force: true});
            });

            // * Verify that an error message is displayed.
            cy.findByText('The file must be a valid JSON playbook template.').should('be.visible');
        });
    });
});
