// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage: @prod
// Group: @channels @interactive_dialog

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*
* Single slash command `/checkbox_group_dialog` opens the full feature demo dialog:
* - two checkbox_group fields (label before / after)
* - optional radio with clear
* - bool with label before
* - two checkbox_matrix fields (multiple / single row selection)
*/

const webhookUtils = require('../../../../utils/webhook_utils');

let checkboxGroupCommand;

function openCheckboxDemoDialog() {
    cy.postMessage(`/${checkboxGroupCommand.trigger} `);
    cy.get('#appsModal').should('be.visible');
}

describe('Interactive Dialog - Checkbox Elements', () => {
    before(() => {
        cy.apiSaveTeammateNameDisplayPreference('username');
        cy.requireWebhookServer();

        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.expose().webhookBaseUrl;

            const groupCommand = {
                auto_complete: false,
                description: 'Checkbox dialog feature demo',
                display_name: 'Checkbox Dialog Demo',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'checkbox_group_dialog',
                url: `${webhookBaseUrl}/checkbox_group_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(groupCommand).then(({data}) => {
                checkboxGroupCommand = data;
                webhookUtils.getCheckboxGroupDialog(data.id, webhookBaseUrl);
            });
        });
    });

    afterEach(() => {
        // # Reload the page after each test to close any dialog left open, so the
        // next test's cy.postMessage isn't blocked by a modal covering the textbox.
        cy.reload();
    });

    it('MM-T9001 - checkbox_group renders label before and label after', () => {
        openCheckboxDemoDialog();

        cy.get('#appsModal').within(() => {
            cy.get('.modal-body').within(() => {
                cy.get('[data-testid="waiver_group_label_before"]').within(() => {
                    cy.get('label.control-label').should('contain', 'Group A: label before');
                    cy.get('.checkbox').should('have.length', 3);
                    cy.get('.checkbox').each(($checkbox) => {
                        cy.wrap($checkbox).find('label').then(($label) => {
                            const textNode = $label.find('.inline-choice-setting__text')[0];
                            const inputNode = $label.find('input[type="checkbox"]')[0];
                            expect(textNode.compareDocumentPosition(inputNode)).to.equal(Node.DOCUMENT_POSITION_FOLLOWING);
                        });
                    });
                    cy.get('input[type="checkbox"]').eq(0).should('be.checked');
                    cy.get('input[type="checkbox"]').eq(1).should('not.be.checked');
                    cy.get('input[type="checkbox"]').eq(2).should('be.checked');
                });

                cy.get('[data-testid="waiver_group_label_after"]').within(() => {
                    cy.get('label.control-label').should('contain', 'Group B: label after');
                    cy.get('.checkbox').should('have.length', 3);
                    cy.get('.checkbox').each(($checkbox) => {
                        cy.wrap($checkbox).find('label').then(($label) => {
                            const textNode = $label.find('.inline-choice-setting__text')[0];
                            const inputNode = $label.find('input[type="checkbox"]')[0];
                            expect(textNode.compareDocumentPosition(inputNode)).to.equal(Node.DOCUMENT_POSITION_PRECEDING);
                        });
                    });
                    cy.get('input[type="checkbox"]').eq(1).should('be.checked');
                });
            });
        });
    });

    it('MM-T9002 - checkbox_matrix multiple toggles checkboxes per row', () => {
        openCheckboxDemoDialog();

        cy.get('#appsModal').within(() => {
            cy.get('[data-testid="severity_multiple"]').within(() => {
                // The demo dialog is taller than the modal body; scroll the matrix
                // into view before asserting visibility (be.visible does not auto-scroll).
                cy.get('table.checkbox-matrix').scrollIntoView().should('be.visible');
                cy.get('table.checkbox-matrix tbody tr').should('have.length', 3);
                cy.get('table.checkbox-matrix thead th').should('have.length', 3);
                cy.get('input[type="checkbox"]').should('have.length', 6);

                cy.get('table.checkbox-matrix tbody tr').first().within(() => {
                    cy.get('input[type="checkbox"]').first().check();
                    cy.get('input[type="checkbox"]').last().check();
                    cy.get('input[type="checkbox"]').first().should('be.checked');
                    cy.get('input[type="checkbox"]').last().should('be.checked');
                });
            });
        });
    });

    it('MM-T9003 - checkbox_matrix single uses radio inputs per row', () => {
        openCheckboxDemoDialog();

        cy.get('#appsModal').within(() => {
            cy.get('[data-testid="priority_single"]').within(() => {
                cy.get('table.checkbox-matrix tbody tr').should('have.length', 3);
                cy.get('input[type="radio"]').should('have.length', 9);

                cy.get('table.checkbox-matrix tbody tr').first().within(() => {
                    cy.get('input[type="radio"]').eq(1).check();
                    cy.get('input[type="radio"]').eq(1).should('be.checked');
                    cy.get('input[type="radio"]').eq(0).should('not.be.checked');
                    cy.get('input[type="radio"]').eq(2).should('not.be.checked');
                });
            });
        });
    });

    it('MM-T9004 - optional radio shows clear selection control', () => {
        openCheckboxDemoDialog();

        cy.get('#appsModal').within(() => {
            cy.get('[data-testid="department"]').within(() => {
                cy.get('input[type="radio"][value="sales"]').should('be.checked');
                cy.get('.radio-setting__clear').scrollIntoView().should('be.visible').click();
                cy.get('input[type="radio"]:checked').should('not.exist');
            });
        });
    });

    it('MM-T9005 - required checkbox_group blocks submit when empty', () => {
        openCheckboxDemoDialog();

        cy.get('#appsModal').within(() => {
            cy.get('[data-testid="waiver_group_label_before"]').within(() => {
                cy.get('input[type="checkbox"]').uncheck({force: true});
            });

            cy.get('#appsModalSubmit').click();
            cy.get('[data-testid="waiver_group_label_before"]').find('.error-text').should('be.visible');
        });
    });

    it('MM-T9006 - bool and optional checkbox_group render on demo dialog', () => {
        openCheckboxDemoDialog();

        cy.get('#appsModal').within(() => {
            cy.get('[data-testid="acknowledged"]').within(() => {
                cy.get('label.control-label').should('contain', 'Acknowledgement');
                cy.get('.inline-choice-setting__text').should('contain', 'I understand the waiver terms');
                cy.get('input[type="checkbox"]').should('exist');
            });

            cy.get('[data-testid="waiver_group_label_after"]').within(() => {
                cy.get('label.control-label').should('contain', '(optional)');
            });
        });
    });
});
