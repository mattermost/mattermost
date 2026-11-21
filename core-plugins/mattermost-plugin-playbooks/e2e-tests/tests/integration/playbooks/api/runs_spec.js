// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('api > runs', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('creating a run', () => {
        describe('in an existing, public channel', () => {
            it('with no team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel

                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with correct team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: testTeam.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with wrong team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: 'other_team_id',
                    }, {expectedStatusCode: 400}).then((body) => {
                        expect(body).to.have.property('error', 'unable to create playbook run');
                    });
                });
            });
        });

        describe('in an existing, private channel', () => {
            it('with no team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with correct team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: testTeam.id,
                    }, {expectedStatusCode: 201}).then((body) => {
                        expect(body).to.have.property('owner_user_id', testUser.id);
                        expect(body).to.have.property('reporter_user_id', testUser.id);
                        expect(body).to.have.property('team_id', testTeam.id);
                        expect(body).to.have.property('channel_id', channel.id);
                        expect(body).to.have.property('playbook_id', testPlaybook.id);
                    });
                });
            });

            it('with wrong team_id specified', () => {
                // # Create a test channel without a playbook run
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                    // # Run the testPlaybook in the previously created channel
                    cy.apiRunPlaybook({
                        ownerUserId: testUser.id,
                        channelId: channel.id,
                        playbookId: testPlaybook.id,
                        teamId: 'other_team_id',
                    }, {expectedStatusCode: 400}).then((body) => {
                        expect(body).to.have.property('error', 'unable to create playbook run');
                    });
                });
            });
        });

        it('in an existing, private channel, of which the user is not a member', () => {
            // # Create a test channel without a playbook run
            cy.apiCreateChannel(testTeam.id, 'channel', 'Channel', 'P').then(({channel}) => {
                // # Leave the channel
                cy.apiRemoveUserFromChannel(channel.id, testUser.id);

                // # Run the testPlaybook in the previously created channel
                cy.apiRunPlaybook({
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                    playbookId: testPlaybook.id,
                    teamId: testTeam.id,
                }, {expectedStatusCode: 403}).then((body) => {
                    expect(body).to.have.property('error', 'unable to create playbook run');
                });
            });
        });

        it('in a channel with an existing playbook run', () => {
            // # Run the playbook, creating a channel.
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Playbook',
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Run the testPlaybook in the previously created channel
                cy.apiRunPlaybook({
                    owner_user_id: testUser.id,
                    channel_id: playbookRun.channel_id,
                    playbook_id: testPlaybook.id,
                }, {expectedStatusCode: 400}).then((body) => {
                    expect(body).to.have.property('error', 'unable to create playbook run');
                });
            });
        });
    });
});
