// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('runs > task actions', {testIsolation: true}, () => {
    let testPlaybook;
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
            });
        });
    });

    beforeEach(() => {
        // # intercepts telemetry
        cy.interceptTelemetry();

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('keywords trigger - mark task as done', () => {
        let testPlaybookRun;

        const getChecklist = () => cy.findByTestId('run-checklist-section');
        const getChecklistTasks = () => getChecklist().findAllByTestId('checkbox-item-container');

        beforeEach(() => {
            // # Run a playbook
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: `the run name ${Date.now()}`,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                testPlaybookRun = playbookRun;

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);
            });
        });

        it('disallows no keywords', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify no actions are configured
            cy.findByText('Task Actions').should('exist');

            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, []);
                assert.deepEqual(trigger.user_ids, []);
                assert.isFalse(actions.enabled);
            });
        });

        it('allows a single keyword', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // # Enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

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
                        playbookrun_id: testPlaybookRun.id,
                    },
                },
            ]);

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser2.username} checked off checklist item "Test Task"`);
        });

        it('allows multiple keywords', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add multiple keywords
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
                cy.get('input').eq(0).type('keyword2{enter}', {force: true});
            });

            // # Enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword1', 'keyword2']);
                assert.deepEqual(trigger.user_ids, []);
                assert.isTrue(actions.enabled);
            });

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword2 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser2.username} checked off checklist item "Test Task"`);
        });

        it('allows multi-word phrases', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a phrase
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('a phrase with multiple words{enter}', {force: true});
            });

            // # Enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['a phrase with multiple words']);
                assert.deepEqual(trigger.user_ids, []);
                assert.isTrue(actions.enabled);
            });

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and a phrase with multiple words happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser2.username} checked off checklist item "Test Task"`);
        });

        it('allows removing previously configured keywords', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add multiple keywords
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
                cy.get('input').eq(0).type('keyword2{enter}', {force: true});
            });

            // # Enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // # Re-open the dialog
            cy.findByText('1 action').click();

            // # Remove one trigger keyword
            cy.get('.modal-body').within(() => {
                cy.findByText('keyword1').next().click();
            });

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword2']);
                assert.deepEqual(trigger.user_ids, []);
                assert.isTrue(actions.enabled);
            });

            // # Post without activating trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action not activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('not.be.checked');

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword2 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser2.username} checked off checklist item "Test Task"`);
        });

        it('disables when all keywords removed', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add multiple keywords
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
                cy.get('input').eq(0).type('keyword2{enter}', {force: true});
            });

            // # Enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // # Re-open the dialog
            cy.findByText('1 action').click();

            // # Remove all trigger keywords
            cy.get('.modal-body').within(() => {
                cy.findByText('keyword1').next().click();
                cy.findByText('keyword2').next().click();
            });

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions
            cy.findByText('Task Actions');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, []);
                assert.deepEqual(trigger.user_ids, []);
                assert.isFalse(actions.enabled);
            });

            // # Post without activating trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh keyword1 keyword2 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action not activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('not.be.checked');
        });

        it('disallows a user without keywords', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a user
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(1).
                    type('@' + testUser.username, {force: true}).
                    wait(TIMEOUTS.ONE_SEC).
                    type('{enter}', {force: true});
            });

            // # Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify no actions are configured
            cy.findByText('Task Actions');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, []);
                assert.deepEqual(trigger.user_ids, [testUser.id]);
                assert.isFalse(actions.enabled);
            });
        });

        it('allows a single user', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // # Add a user
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(1).
                    type('@' + testUser.username, {force: true}).
                    wait(TIMEOUTS.ONE_SEC).
                    type('{enter}', {force: true});
            });

            // # Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions and user
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword1']);
                assert.deepEqual(trigger.user_ids, [testUser.id]);
                assert.isTrue(actions.enabled);
            });

            // # Post without activating trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action not activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('not.be.checked');

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser.id);
            cy.postMessageAs({
                sender: testUser,
                message: `hello from ${testUser.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser.username} checked off checklist item "Test Task"`);
        });

        it('allows configuring multiple users', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // # Add two users
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

            // # Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions and user
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword1']);
                assert.deepEqual(trigger.user_ids, [testUser.id, testUser2.id]);
                assert.isTrue(actions.enabled);
            });

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser.id);
            cy.postMessageAs({
                sender: testUser,
                message: `hello from ${testUser.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser.username} checked off checklist item "Test Task"`);

            // # Reset-uncheck task
            cy.apiSetChecklistItemState(testPlaybookRun.id, 0, 0, '');
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('not.be.checked');

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser2.username} checked off checklist item "Test Task"`);
        });

        it('rejects unknown user', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // # Type an unknown user
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(1).
                    type('@unknown', {force: true}).
                    wait(TIMEOUTS.ONE_SEC).
                    type('{enter}', {force: true});
            });

            // # Click away
            cy.get('.modal-body').click();

            // # Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions and user
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword1']);
                assert.deepEqual(trigger.user_ids, []);
                assert.isTrue(actions.enabled);
            });

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser.id);
            cy.postMessageAs({
                sender: testUser,
                message: `hello from ${testUser.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser.username} checked off checklist item "Test Task"`);
        });

        it('allows removing previously configured users', () => {
            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // # Add two users
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

            // # Attempt to enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // # Re-open the dialog
            cy.findByText('1 action').click();

            // # Remove one user keyword
            cy.get('.modal-body').within(() => {
                cy.findByText(testUser.username).parent().parent().next().click();
            });

            // Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(testPlaybookRun.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword1']);
                assert.deepEqual(trigger.user_ids, [testUser2.id]);
                assert.isTrue(actions.enabled);
            });

            // # Post without activating trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser.id);
            cy.postMessageAs({
                sender: testUser,
                message: `hello from ${testUser.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action NOT activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('not.be.checked');

            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testPlaybookRun.channel_id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testPlaybookRun.channel_id,
            });

            // * Verify action activated
            getChecklistTasks().eq(0).find('input[type="checkbox"]').should('be.checked');
            cy.findAllByTestId('timeline-item task_state_modified').findByText(`${testUser2.username} checked off checklist item "Test Task"`);
        });
    });

    describe('keywords trigger - mark task as done, multiple runs in a channel', () => {
        let testChannel;
        let testPlaybookRun1;
        let testPlaybookRun2;

        const configureTaskAction = (run) => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${run.id}`);

            // # Open the task actions modal
            cy.findByText('Task Actions').click();

            // # Add a keyword
            cy.get('.modal-body').within(() => {
                cy.get('input').eq(0).type('keyword1{enter}', {force: true});
            });

            // # Enable the trigger
            cy.findByText('Mark the task as done').click();

            // # Save the dialog
            cy.findByTestId('modal-confirm-button').click();

            // * Verify configured actions
            cy.findByText('1 action');
            cy.apiGetPlaybookRun(run.id).then(({body: playbookRun}) => {
                const trigger = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].trigger.payload);
                const actions = JSON.parse(playbookRun.checklists[0].items[0].task_actions[0].actions[0].payload);

                assert.deepEqual(trigger.keywords, ['keyword1']);
                assert.deepEqual(trigger.user_ids, []);
                assert.isTrue(actions.enabled);
            });
        };

        beforeEach(() => {
            cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                testChannel = channel;

                // # Run #1
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: `the run name ${Date.now()}`,
                    ownerUserId: testUser.id,
                    channelId: testChannel.id,
                }).then((playbookRun) => {
                    testPlaybookRun1 = playbookRun;
                    configureTaskAction(testPlaybookRun1);
                });

                // # Run #2
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: `the run name ${Date.now()}`,
                    ownerUserId: testUser.id,
                    channelId: testChannel.id,
                }).then((playbookRun) => {
                    testPlaybookRun2 = playbookRun;
                    configureTaskAction(testPlaybookRun2);
                });
            });
        });

        it('triggers', () => {
            // # Attempt to activate trigger
            cy.apiAddUserToChannel(testChannel.id, testUser2.id);
            cy.postMessageAs({
                sender: testUser2,
                message: `hello from ${testUser2.username}: ${Date.now()}, oh and keyword1 happened`,
                channelId: testChannel.id,
            });

            // Give the system a chance to effect the task actions.
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Verify action activated ion testPlaybookRun1
            cy.apiGetPlaybookRun(testPlaybookRun1.id).then(({body: playbookRun}) => {
                assert.equal(playbookRun.checklists[0].items[0].state, 'closed');
            });

            // * Verify action activated in testPlaybookRun2
            cy.apiGetPlaybookRun(testPlaybookRun2.id).then(({body: playbookRun}) => {
                assert.equal(playbookRun.checklists[0].items[0].state, 'closed');
            });
        });
    });
});
