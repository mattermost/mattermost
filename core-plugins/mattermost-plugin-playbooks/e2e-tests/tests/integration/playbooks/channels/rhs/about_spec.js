// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ONE_SEC} from '../../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > header', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testPlaybookRun;
    let playbookRunChannelName;
    let playbookRunName;
    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Run the playbook
        const now = Date.now();
        playbookRunName = 'Playbook Run (' + now + ')';
        playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        }).then((run) => {
            testPlaybookRun = run;
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);
    });

    describe('shows name', () => {
        it('of active playbook run', () => {
            // * Verify the title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);
        });

        it('of renamed playbook run', () => {
            // * Verify the existing title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);

            // # Rename the channel
            cy.apiPatchChannel(testPlaybookRun.channel_id, {
                id: testPlaybookRun.channel_id,
                display_name: 'Updated',
            });

            // * Verify the updated title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);
        });
    });

    describe('edit run name', () => {
        it('by clicking on name', () => {
            // # Click the menu button to open the dropdown
            cy.get('#rhsContainer').findByTestId('rendered-run-name').should('be.visible');
            cy.get('#rhsContainer').findByTestId('menuButton').should('be.visible').click();

            // # Click "Rename" from the dropdown menu
            cy.findByText('Rename').click();

            // # type text in textarea
            cy.get('#rhsContainer').findByTestId('textarea-run-name').should('be.visible').clear().type('new run name{enter}');

            // * make sure the updated name is here
            cy.get('#rhsContainer').findByTestId('rendered-run-name').should('be.visible').contains('new run name');

            // * make sure the channel name remains unchanged
            cy.get('#channel-header').contains(playbookRunName);
        });
    });

    describe('edit summary', () => {
        it('by clicking on placeholder', () => {
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // # type text in textarea
            cy.get('#rhsContainer').findByTestId('textarea-description').should('be.visible').type('new summary{ctrl+enter}');

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });

        // https://mattermost.atlassian.net/browse/MM-63692
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('by clicking on dot menu item', () => {
            // # click on the field
            cy.get('#rhsContainer').within(() => {
                cy.findByTestId('buttons-row').invoke('show').within(() => {
                    cy.findAllByRole('button').eq(1).click();
                });
            });

            cy.findByText('Edit run summary').click();

            cy.wait(ONE_SEC);

            // # type text in textarea
            cy.focused().should('be.visible').as('textarea');
            cy.get('@textarea').type('new summary');
            cy.wait(ONE_SEC);
            cy.get('@textarea').type('{ctrl+enter}');

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });
    });

    describe('participate', () => {
        it('icon is not visible if I am a participant', () => {
            // * assert icon is not visible if I'm participant
            cy.get('#rhsContainer').findByTestId('rhs-participate-icon').should('not.exist');
        });
    });
});
