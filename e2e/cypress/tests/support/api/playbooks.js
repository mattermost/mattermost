// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const playbookRunsEndpoint = '/plugins/playbooks/api/v0/runs';

const StatusOK = 200;
const StatusCreated = 201;

/**
 * Get all playbook runs directly via API
 */
Cypress.Commands.add('apiGetAllPlaybookRuns', (teamId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/runs',
        qs: {team_id: teamId, per_page: 10000},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

/**
 * Get all InProgress playbook runs directly via API
 */
Cypress.Commands.add('apiGetAllInProgressPlaybookRuns', (teamId, userId = '') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/runs',
        qs: {team_id: teamId, status: 'InProgress', participant_id: userId},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

/**
 * Get playbook run by name directly via API
 */
Cypress.Commands.add('apiGetPlaybookRunByName', (teamId, name) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/runs',
        qs: {team_id: teamId, search_term: name},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

/**
 * Get a playbook run directly via API
 * @param {String} playbookRunId
 * All parameters required
 */
Cypress.Commands.add('apiGetPlaybookRun', (playbookRunId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${playbookRunsEndpoint}/${playbookRunId}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

/**
 * Start a playbook run directly via API.
 */
Cypress.Commands.add('apiRunPlaybook', (
    {
        teamId,
        playbookId,
        playbookRunName,
        ownerUserId,
        channelId,
        description,
    }, options) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbookRunsEndpoint,
        method: 'POST',
        body: {
            name: playbookRunName,
            owner_user_id: ownerUserId,
            team_id: teamId,
            playbook_id: playbookId,
            channel_id: channelId,
            description,
        },
        failOnStatusCode: !(options?.expectedStatusCode),
    }).then((response) => {
        const statusCode = options?.expectedStatusCode || StatusCreated;
        expect(response.status).to.equal(statusCode);
        cy.wrap(response.body);
    });
});

// Finish a playbook's run programmaticially. Uses currently logged in user, so that user must
// have edit permissions on the run
Cypress.Commands.add('apiFinishRun', (playbookRunId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${playbookRunsEndpoint}/${playbookRunId}/finish`,
        method: 'PUT',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

// Update a playbook run's status programmatically.
Cypress.Commands.add('apiUpdateStatus', (
    {
        playbookRunId,
        message,
        reminder = 300,
    }) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `${playbookRunsEndpoint}/${playbookRunId}/status`,
        method: 'POST',
        body: {
            message,
            reminder,
        },
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

/**
 * Change the owner of a playbook run directly via API
 * @param {String} playbookRunId
 * @param {String} userId
 * All parameters required
 */
Cypress.Commands.add('apiChangePlaybookRunOwner', (playbookRunId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbookRunsEndpoint + '/' + playbookRunId + '/owner',
        method: 'POST',
        body: {
            owner_id: userId,
        },
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

/**
 * Change the assignee of a checklist item directly via API
 * @param {String} playbookRunId
 * @param {String} checklistId
 * @param {String} itemId
 * @param {String} userId
 * All parameters required
 */
Cypress.Commands.add('apiChangeChecklistItemAssignee', (playbookRunId, checklistId, itemId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbookRunsEndpoint + `/${playbookRunId}/checklists/${checklistId}/item/${itemId}/assignee`,
        method: 'PUT',
        body: {
            assignee_id: userId,
        },
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

/**
 * Check a checklist item directly via API
 * @param {String} playbookRunId
 * @param {String} checklistId
 * @param {String} itemId
 * @param {String} state ('' or 'closed')
 */
Cypress.Commands.add('apiSetChecklistItemState', (playbookRunId, checklistId, itemId, state) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: playbookRunsEndpoint + `/${playbookRunId}/checklists/${checklistId}/item/${itemId}/state`,
        method: 'PUT',
        body: {
            new_state: state,
        },
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response);
    });
});

// Verify playbook run is created
Cypress.Commands.add('verifyPlaybookRunActive', (teamId, playbookRunName, playbookRunDescription) => {
    cy.apiGetPlaybookRunByName(teamId, playbookRunName).then((response) => {
        const returnedPlaybookRuns = response.body;
        const playbookRun = returnedPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
        assert.isDefined(playbookRun);
        assert.equal(playbookRun.end_at, 0);
        assert.equal(playbookRun.name, playbookRunName);

        cy.log('test 1');

        // Only check the description if provided. The server may supply a default depending
        // on how the playbook run was started.
        if (playbookRunDescription) {
            assert.equal(playbookRun.description, playbookRunDescription);
        }
    });
});

// Verify playbook run exists but is not active
Cypress.Commands.add('verifyPlaybookRunEnded', (teamId, playbookRunName) => {
    cy.apiGetPlaybookRunByName(teamId, playbookRunName).then((response) => {
        const returnedPlaybookRuns = response.body;
        const playbookRun = returnedPlaybookRuns.items.find((inc) => inc.name === playbookRunName);
        assert.isDefined(playbookRun);
        assert.notEqual(playbookRun.end_at, 0);
    });
});

// Create a playbook programmatically.
Cypress.Commands.add('apiCreatePlaybook', (
    {
        teamId,
        title,
        description,
        createPublicPlaybookRun,
        createChannelMemberOnNewParticipant = true,
        checklists,
        memberIDs,
        makePublic = true,
        broadcastEnabled,
        broadcastChannelIds,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds = 24 * 60 * 60, // 24 hours
        statusUpdateEnabled = true,
        retrospectiveReminderIntervalSeconds,
        retrospectiveTemplate,
        retrospectiveEnabled = true,
        invitedUserIds,
        inviteUsersEnabled,
        defaultOwnerId,
        defaultOwnerEnabled,
        announcementChannelId,
        announcementChannelEnabled,
        webhookOnCreationURLs,
        webhookOnCreationEnabled,
        webhookOnStatusUpdateURLs,
        webhookOnStatusUpdateEnabled,
        messageOnJoin,
        messageOnJoinEnabled,
        signalAnyKeywords,
        signalAnyKeywordsEnabled,
        channelNameTemplate,
        runSummaryTemplate,
        runSummaryTemplateEnabled,
        channelMode = 'create_new_channel',
        channelId = '',
        metrics,
    }) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/playbooks',
        method: 'POST',
        body: {
            title,
            description,
            team_id: teamId,
            create_public_playbook_run: createPublicPlaybookRun,
            create_channel_member_on_new_participant: createChannelMemberOnNewParticipant,
            checklists,
            public: makePublic,
            members: memberIDs?.map((val) => ({user_id: val, roles: ['playbook_member', 'playbook_admin']})),
            broadcast_enabled: broadcastEnabled,
            broadcast_channel_ids: broadcastChannelIds,
            reminder_message_template: reminderMessageTemplate,
            reminder_timer_default_seconds: reminderTimerDefaultSeconds,
            status_update_enabled: statusUpdateEnabled,
            retrospective_reminder_interval_seconds: retrospectiveReminderIntervalSeconds,
            retrospective_template: retrospectiveTemplate,
            retrospective_enabled: retrospectiveEnabled,
            invited_user_ids: invitedUserIds,
            invite_users_enabled: inviteUsersEnabled,
            default_owner_id: defaultOwnerId,
            default_owner_enabled: defaultOwnerEnabled,
            announcement_channel_id: announcementChannelId,
            announcement_channel_enabled: announcementChannelEnabled,
            webhook_on_creation_urls: webhookOnCreationURLs,
            webhook_on_creation_enabled: webhookOnCreationEnabled,
            webhook_on_status_update_urls: webhookOnStatusUpdateURLs,
            webhook_on_status_update_enabled: webhookOnStatusUpdateEnabled,
            message_on_join: messageOnJoin,
            message_on_join_enabled: messageOnJoinEnabled,
            signal_any_keywords: signalAnyKeywords,
            signal_any_keywords_enabled: signalAnyKeywordsEnabled,
            channel_name_template: channelNameTemplate,
            run_summary_template: runSummaryTemplate,
            run_summary_template_enabled: runSummaryTemplateEnabled,
            channel_mode: channelMode,
            channel_id: channelId,
            metrics,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        cy.wrap(response.headers.location);
    }).then((location) => {
        cy.request({
            url: location,
            method: 'GET',
        }).then((response) => {
            cy.wrap(response.body);
        });
    });
});

// Create a test playbook programmatically.
Cypress.Commands.add('apiCreateTestPlaybook', (
    {
        teamId,
        title,
        userId,
        broadcastEnabled,
        broadcastChannelIds,
        reminderMessageTemplate,
        checklists,
        inviteUsersEnabled,
        reminderTimerDefaultSeconds = 24 * 60 * 60, // 24 hours
        otherMembers = [],
        invitedUserIds = [],
        channelNameTemplate = '',
    }) => (
    cy.apiCreatePlaybook({
        teamId,
        title,
        checklists: checklists || [{
            title: 'Stage 1',
            items: [
                {title: 'Step 1'},
                {title: 'Step 2'},
            ],
        }],
        memberIDs: [
            userId,
            ...otherMembers,
        ],
        broadcastEnabled,
        broadcastChannelIds,
        reminderMessageTemplate,
        reminderTimerDefaultSeconds,
        invitedUserIds,
        inviteUsersEnabled,
        channelNameTemplate,
        createChannelMemberOnNewParticipant: true,
        removeChannelMemberOnRemovedParticipant: true,
    })
));

// Verify that the playbook was created
Cypress.Commands.add('verifyPlaybookCreated', (teamId, playbookTitle) => (
    cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/playbooks',
        qs: {team_id: teamId, sort: 'title', direction: 'asc'},
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        const playbookResults = response.body;
        const playbook = playbookResults.items.find((p) => p.title === playbookTitle);
        assert.isDefined(playbook);
    })
));

// Get a playbook
Cypress.Commands.add('apiGetPlaybook', (playbookId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/playbooks/api/v0/playbooks/${playbookId}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

// Update a playbook
Cypress.Commands.add('apiUpdatePlaybook', (playbook, expectedHttpCode = StatusOK) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/playbooks/api/v0/playbooks/${playbook.id}`,
        method: 'PUT',
        body: JSON.stringify(playbook),
        failOnStatusCode: false,
    }).then((response) => {
        expect(response.status).to.equal(expectedHttpCode);
        cy.wrap(response.body);
    });
});

// Archive a playbook
Cypress.Commands.add('apiArchivePlaybook', (playbookId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/playbooks/api/v0/playbooks/${playbookId}`,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(204);
    });
});

// Follow a playbook run
Cypress.Commands.add('apiFollowPlaybookRun', (playbookRunId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/playbooks/api/v0/runs/${playbookRunId}/followers`,
        method: 'PUT',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

// Unfollow a playbook run
Cypress.Commands.add('apiUnfollowPlaybookRun', (playbookRunId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/plugins/playbooks/api/v0/runs/${playbookRunId}/followers`,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

//addUsersToRun
Cypress.Commands.add('apiAddUsersToRun', (playbookRunId, usersIds) => {
    const query = `
        mutation AddRunParticipants($runID: String!, $userIDs: [String!]!) {
            addRunParticipants(runID: $runID, userIDs: $userIDs)
        }
    `;
    const vars = {
        runID: playbookRunId,
        userIDs: usersIds,
    };
    return doGraphqlQuery(query, 'AddRunParticipants', vars).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

//updateRun
Cypress.Commands.add('apiUpdateRun', (playbookRunId, updates) => {
    const query = `
        mutation UpdateRun($id: String!, $updates: RunUpdates!) {
            updateRun(id: $id, updates: $updates)
        }
    `;
    const vars = {
        id: playbookRunId,
        updates,
    };
    return doGraphqlQuery(query, 'UpdateRun', vars).then((response) => {
        expect(response.status).to.equal(StatusOK);
        cy.wrap(response.body);
    });
});

const doGraphqlQuery = (query, operationName, variables) => {
    const payload = {query, operationName, variables};
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/plugins/playbooks/api/v0/query',
        body: JSON.stringify(payload),
        method: 'POST',
    });
};
