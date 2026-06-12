// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @interactive_dialog

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

const webhookUtils = require('../../../../utils/webhook_utils');

let createdCommand;
let fileUploadDialog;

describe('Interactive Dialog - File Upload', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        // # Create new team and create command on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.expose().webhookBaseUrl;

            // # Create slash command that triggers the file upload dialog
            const command = {
                auto_complete: false,
                description: 'Test for file upload dialog elements',
                display_name: 'File Upload Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'file_upload_dialog',
                url: `${webhookBaseUrl}/file_upload_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                fileUploadDialog = webhookUtils.getFileUploadDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T6070 - Renders file upload dialog with correct labels and buttons', () => {
        // # Post the slash command to open the dialog
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify header contains the correct title
            cy.get('.modal-header').should('be.visible').within(() => {
                cy.get('#appsModalLabel').should('be.visible').and('have.text', fileUploadDialog.dialog.title);
            });

            // * Verify both file form-groups are present with correct display names
            cy.get('.modal-body').should('be.visible').within(() => {
                const singleElement = fileUploadDialog.dialog.elements[0];
                const multipleElement = fileUploadDialog.dialog.elements[1];

                // * Verify single_document form-group renders with its label
                cy.get('.apps-form-file-upload').eq(0).within(() => {
                    cy.get('label').should('be.visible').and('contain', singleElement.display_name);

                    // * Verify "Choose File" button for allow_multiple=false
                    cy.get('button.btn-tertiary').should('be.visible').and('have.text', 'Choose File');

                    // * Verify placeholder / help text is visible before any upload
                    cy.get('.help-text').should('be.visible');
                });

                // * Verify multiple_files form-group renders with its label
                cy.get('.apps-form-file-upload').eq(1).within(() => {
                    cy.get('label').should('be.visible').and('contain', multipleElement.display_name);

                    // * Verify "Choose Files" button for allow_multiple=true
                    cy.get('button.btn-tertiary').should('be.visible').and('have.text', 'Choose Files');

                    // * Verify placeholder / help text is visible before any upload
                    cy.get('.help-text').should('be.visible');
                });
            });

            // * Verify footer submit label matches the dialog definition
            cy.get('.modal-footer').should('be.visible').within(($footer) => {
                cy.wrap($footer).find('#appsModalCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($footer).find('#appsModalSubmit').should('be.visible').and('have.text', fileUploadDialog.dialog.submit_label);
            });
        });

        // # Close the modal (outside within() so the not.exist check is not vacuous)
        closeAppsFormModal();
    });

    it('MM-T6071 - Uploads files to both required fields and submits successfully', () => {
        // # Post the slash command to open the dialog
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Upload a file to the single_document field (required, allow_multiple=false)
            cy.get('input#single_document').attachFile('png-image-file.png');

            // * Verify a completed file preview appears for single_document
            // (.post-image__details renders only once the upload has finished)
            cy.get('.apps-form-file-upload').eq(0).within(() => {
                cy.get('.post-image__details').should('have.length', 1);
            });

            // # Upload a file to the multiple_files field (required, allow_multiple=true)
            cy.get('input#multiple_files').attachFile('small-image.png');

            // * Verify a completed file preview appears for multiple_files
            cy.get('.apps-form-file-upload').eq(1).within(() => {
                cy.get('.post-image__details').should('have.length', 1);
            });

            // # Wait for the submit button to re-enable. It is disabled while any field
            // is interacting (an upload in progress) and re-enables only once uploads
            // settle — the same point the uploaded file IDs propagate into the form
            // values. Deterministic signal, no fixed wait needed.
            cy.get('#appsModalSubmit').should('not.be.disabled');

            // # Intercept the dialog submit API call and click Submit
            cy.intercept('/api/v4/actions/dialogs/submit').as('submitAction');
            cy.get('#appsModalSubmit').click();
        });

        // * Verify that the apps form modal is closed after successful submission
        cy.get('#appsModal').should('not.exist');

        // * Verify the submission body contains the correct file ID structure
        cy.wait('@submitAction').should('include.all.keys', ['request', 'response']).then((result) => {
            const {submission} = result.request.body;

            // * Verify single_document is submitted as a string (single file ID)
            expect(submission.single_document).to.be.a('string').and.have.length.greaterThan(0);

            // * Verify multiple_files is submitted as a string (comma-separated IDs)
            expect(submission.multiple_files).to.be.a('string').and.have.length.greaterThan(0);

            // * Verify file_ids is an array containing all uploaded file IDs
            expect(result.request.body.file_ids).to.be.an('array').and.have.length.greaterThan(0);

            const singleId = submission.single_document;
            const multipleIds = submission.multiple_files.split(',').filter(Boolean);

            // * Verify file_ids contains all the IDs from both fields
            expect(result.request.body.file_ids).to.include.members([singleId, ...multipleIds]);
        });

        // * Verify the success post appears in the channel
        cy.getLastPost().should('contain', 'Dialog submitted successfully!');
    });

    it('MM-T6072 - allow_multiple appends files; single replaces on second selection', () => {
        // # Post the slash command to open the dialog
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Test allow_multiple=true appends: attach first file to multiple_files
            cy.get('input#multiple_files').attachFile('png-image-file.png');

            // * Verify one completed preview item appears
            cy.get('.apps-form-file-upload').eq(1).within(() => {
                cy.get('.post-image__details').should('have.length', 1);
            });

            // # Attach a second file to multiple_files
            cy.get('input#multiple_files').attachFile('small-image.png');

            // * Verify two preview items appear (appended, not replaced)
            cy.get('.apps-form-file-upload').eq(1).within(() => {
                cy.get('.post-image__details').should('have.length', 2);
            });

            // # Test allow_multiple=false replaces: attach a file to single_document
            cy.get('input#single_document').attachFile('png-image-file.png');

            // * Verify the first file completed (one preview item)
            cy.get('.apps-form-file-upload').eq(0).within(() => {
                cy.get('.post-image__details').should('have.length', 1);
            });

            // # Attach a different file to single_document (should replace, not append)
            cy.get('input#single_document').attachFile('small-image.png');

            // * Verify only one preview item exists for single_document (replaced)
            cy.get('.apps-form-file-upload').eq(0).within(() => {
                cy.get('.post-image__details').should('have.length', 1);
            });
        });

        closeAppsFormModal();
    });

    it('MM-T6073 - Required validation fires when submitting with no files selected', () => {
        // # Post the slash command to open the dialog
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Submit without uploading any files (both file fields are required).
            // Assert the button is interactive first — no uploads are in progress so it
            // is enabled immediately; this is a deterministic gate, not a fixed wait.
            cy.get('#appsModalSubmit').should('be.enabled').click();
        });

        // * Verify that the apps form modal is still visible (validation blocked submission)
        cy.get('#appsModal').should('be.visible');

        // * Verify the inline required error renders on the file field itself,
        // consistent with every other apps-form field type (rendered via .error-text)
        cy.get('#appsModal').within(() => {
            cy.get('.apps-form-file-upload').eq(0).within(() => {
                cy.get('.error-text').should('be.visible').and('contain', 'This field is required');
            });
        });

        closeAppsFormModal();
    });
});

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}
