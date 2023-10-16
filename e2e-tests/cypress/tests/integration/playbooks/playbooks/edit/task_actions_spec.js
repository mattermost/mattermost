// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks
//
import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('playbooks > edit > task actions', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;

                // # Add this new user to the team
                cy.apiAddUserToTeam(team.id, testUser2.id);
            });
        });
    });

    let testPlaybook;
    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook (' + Date.now() + ')',
            checklists: [{
                title: 'Test Checklist',
                items: [
                    {title: 'Test Task'},
                ],
            }],
            memberIDs: [
                testUser.id,
            ],
        }).then((playbook) => {
            testPlaybook = playbook;

            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
        });
    });

    const editTask = () => {
        cy.findByTestId('checkbox-item-container').within(() => {
            cy.findByText('Test Task').trigger('mouseover');
            cy.findByTestId('hover-menu-edit-button').click();
        });
    };

    it('disallows no keywords', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Attempt to enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify no actions are configured
        cy.findByText('Task Actions').should('exist');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, []);
            assert.deepEqual(trigger.user_ids, []);
            assert.isFalse(actions.enabled);
        });
    });

    it('allows a single keyword', () => {
        // # intercepts telemetry
        cy.interceptTelemetry();

        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a keyword
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
        });

        // Enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword1']);
            assert.deepEqual(trigger.user_ids, []);
            assert.isTrue(actions.enabled);
        });

        // # assert telemetry data
        cy.expectTelemetryToContain([
            {
                name: 'taskactions_updated',
                type: 'track',
                properties: {
                    playbook_id: testPlaybook.id,
                },
            },
        ]);
    });

    it('allows multiple keywords', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add multiple keywords
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            cy.get('input').eq(0).type('keyword2{enter}', {force: true});
        });

        // Enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword1', 'keyword2']);
            assert.deepEqual(trigger.user_ids, []);
            assert.isTrue(actions.enabled);
        });
    });

    it('allows multi-word phrases', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a phrase
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('a phrase with multiple words{enter}', {force: true});
        });

        // Enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['a phrase with multiple words']);
            assert.deepEqual(trigger.user_ids, []);
            assert.isTrue(actions.enabled);
        });
    });

    it('allows removing previously configured keywords', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add multiple keywords
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            cy.get('input').eq(0).type('keyword2{enter}', {force: true});
        });

        // Enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Re-open the dialog
        cy.findByText('1 action').click();

        // Remove one trigger keyword
        cy.get('.modal-body').within(() => {
            cy.findByText('keyword1').next().click();
        });

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword2']);
            assert.deepEqual(trigger.user_ids, []);
            assert.isTrue(actions.enabled);
        });
    });

    it('disables when all keywords removed', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add multiple keywords
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            cy.get('input').eq(0).type('keyword2{enter}', {force: true});
        });

        // Enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Re-open the dialog
        cy.findByText('1 action').click();

        // Remove all trigger keywords
        cy.get('.modal-body').within(() => {
            cy.findByText('keyword1').next().click();
            cy.findByText('keyword2').next().click();
        });

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions
        cy.findByText('Task Actions');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, []);
            assert.deepEqual(trigger.user_ids, []);
            assert.isFalse(actions.enabled);
        });
    });

    it('disallows a user without keywords', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a user
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(1).
                type('@' + testUser.username, {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
        });

        // Attempt to enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify no actions are configured
        cy.findByText('Task Actions').should('exist');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, []);
            assert.deepEqual(trigger.user_ids, [testUser.id]);
            assert.isFalse(actions.enabled);
        });
    });

    it('allows a single user', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a keyword
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
        });

        // Add a user
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(1).
                type('@' + testUser.username, {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
        });

        // Attempt to enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions and user
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword1']);
            assert.deepEqual(trigger.user_ids, [testUser.id]);
            assert.isTrue(actions.enabled);
        });
    });

    it('allows configuring multiple users', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a keyword
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
        });

        // Add two users
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(1).
                type('@' + testUser.username, {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
            cy.get('input').eq(1).
                type('@' + testUser2.username, {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
        });

        // Attempt to enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions and user
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword1']);
            assert.deepEqual(trigger.user_ids, [testUser.id, testUser2.id]);
            assert.isTrue(actions.enabled);
        });
    });

    it('rejects unknown user', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a keyword
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
        });

        // Type an unknown user
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(1).
                type('@unknown', {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
        });

        // Click away
        cy.get('.modal-body').click();

        // Attempt to enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions and user
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword1']);
            assert.deepEqual(trigger.user_ids, []);
            assert.isTrue(actions.enabled);
        });
    });

    it('allows removing previously configured users', () => {
        // Open the task actions modal
        editTask();
        cy.findByText('Task Actions').click();

        // Add a keyword
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(0).type('keyword1{enter}', {force: true});
        });

        // Add two users
        cy.get('.modal-body').within(() => {
            cy.get('input').eq(1).
                type('@' + testUser.username, {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
            cy.get('input').eq(1).
                type('@' + testUser2.username, {force: true}).
                wait(TIMEOUTS.ONE_SEC).
                type('{enter}', {force: true});
        });

        // Attempt to enable the trigger
        cy.findByText('Mark the task as done').click();

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Re-open the dialog
        cy.findByText('1 action').click();

        // Remove one user keyword
        cy.get('.modal-body').within(() => {
            cy.findByText(testUser.username).parent().parent().next().click();
        });

        // Save the dialog
        cy.findByTestId('modal-confirm-button').click();

        // Verify configured actions
        cy.findByText('1 action');
        cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
            const trigger = JSON.parse(playbook.checklists[0].items[0].task_actions[0].trigger.payload);
            const actions = JSON.parse(playbook.checklists[0].items[0].task_actions[0].actions[0].payload);

            assert.deepEqual(trigger.keywords, ['keyword1']);
            assert.deepEqual(trigger.user_ids, [testUser2.id]);
            assert.isTrue(actions.enabled);
        });
    });
});
