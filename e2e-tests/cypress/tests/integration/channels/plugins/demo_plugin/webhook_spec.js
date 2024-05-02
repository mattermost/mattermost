// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @plugin @not_cloud

import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {demoPlugin} from '../../../../utils/plugins';

describe('Demo plugin - Webhook events', () => {
    let team1;
    let team2;
    let testUser;
    let admin;
    let testChannel;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Set plugin settings
        const newSettings = {
            PluginSettings: {
                Enable: true,
            },
            ServiceSettings: {
                EnableGifPicker: true,
            },
            FileSettings: {
                EnablePublicLink: true,
            },
        };
        cy.apiUpdateConfig(newSettings);

        cy.apiInitSetup().then(({team, user}) => {
            admin = user;
            team1 = team;

            // # Create team before installing demo plugin
            cy.apiCreateTeam('team', 'Team').then(({team: anotherTeam}) => {
                team2 = anotherTeam;
            });

            // # Install demo plugin by file
            cy.apiUploadAndEnablePlugin(demoPlugin);

            // # Enable webhook events
            cy.visit(`/${team1.name}/channels/off-topic`);
            cy.postMessage('/demo_plugin true ').wait(TIMEOUTS.TWO_SEC);

            // * Verify that hooks are enabled
            cy.getLastPost().contains('enabled', {matchCase: false});

            // # Create channel
            cy.apiCreateChannel(team.id, 'my_test_channel', 'my_test_channel').then(({channel}) => {
                testChannel = channel.name;
            });

            // # Join the demo channel
            cy.visit(`/${team1.name}/channels/demo_plugin`);

            // # Create another user
            cy.apiCreateUser().then(({user: otherUser}) => {
                testUser = otherUser;
                cy.apiAddUserToTeam(team.id, testUser.id);

                // # Login another user
                cy.apiLogin(testUser);

                // # Join the demo channel
                cy.visit(`/${team1.name}/channels/demo_plugin`);
            });
        });
    });

    it('MM-T2408_1 - User posts a message Webhook event', () => {
        // # Post message
        cy.visit(`/${team1.name}/channels/off-topic`);
        cy.postMessage('MM-T2408_1');

        // * Verify message is posted in the demo channel
        cy.visit(`/${team1.name}/channels/demo_plugin`);
        cy.findAllByTestId('postView').should('contain', `MessageHasBeenPosted: @${testUser.username}, ~Town Square`);
    });

    it('MM-T2408_2 - User joined a channel Webhook event', () => {
        // # Join channel
        cy.visit(`/${team1.name}/channels/${testChannel}`).wait(TIMEOUTS.ONE_SEC);
        cy.postMessage('MM-T2408_2');

        // * Verify message is posted in the demo channel
        cy.visit(`/${team1.name}/channels/demo_plugin`);
        cy.findAllByTestId('postView').should('contain', `UserHasJoinedChannel: @${testUser.username}, ~my_test_channel`);
    });

    it('MM-T2408_3 - ​User left a channel Webhook event', () => {
        // # Leave channel
        cy.visit(`/${team1.name}/channels/${testChannel}`);
        cy.uiLeaveChannel(false);

        // * Verify message is posted in the demo plugin channel
        cy.visit(`/${team1.name}/channels/demo_plugin`);
        cy.findAllByTestId('postView').should('contain', `UserHasLeftChannel: @${testUser.username}, ~my_test_channel`);
    });

    it('MM-T2408_4 - User edited a message Webhook event', () => {
        // # Post message
        cy.visit(`/${team1.name}/channels/off-topic`);
        cy.postMessage('MM-T2408_4');

        // # Get last post ID
        cy.getLastPostId().then((postID) => {
            // # click dot menu button
            cy.clickPostDotMenu();

            // # click edit post
            cy.get(`#edit_post_${postID}`).click();

            // # Edit message and finish by hitting `enter`
            cy.get('#edit_textbox').
                should('be.visible').
                and('be.focused').
                wait(TIMEOUTS.HALF_SEC).
                type('MM-T2408_4 edited').
                type('{enter}');

            // # Open demo plugin channel
            cy.visit(`/${team1.name}/channels/demo_plugin`);

            // * Verify event posted in the channel
            cy.findAllByTestId('postView').should('contain', `MessageHasBeenUpdated: @${testUser.username}, ~Off-Topic`);
        });
    });

    it('MM-T2408_5 - User adds a reaction to a message Webhook event', () => {
        // # Post message
        cy.visit(`/${team1.name}/channels/off-topic`);
        cy.postMessage('MM-T2408_5');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker('slightly_frowning_face');

            cy.visit(`/${team1.name}/channels/demo_plugin`);

            // * Verify event posted in the channel
            cy.findAllByTestId('postView').should('contain', `ReactionHasBeenAdded: @${testUser.username}, `).and('contain', ':slightly_frowning_face:');
        });
    });

    it('MM-T2408_6 - ​User joined the team Webhook event', () => {
        // # Add user to the team
        cy.apiAdminLogin(admin);
        cy.apiAddUserToTeam(team2.id, testUser.id);

        // # Open demo plugin channel
        cy.visit(`/${team2.name}/channels/demo_plugin`);

        // * Verify event is posted in the channel
        cy.findAllByTestId('postView').should('contain', `UserHasJoinedTeam: @${testUser.username}`);
    });

    it('MM-T2408_7 - ​User left a team Webhook event', () => {
        // # Delete user from team
        cy.apiDeleteUserFromTeam(team2.id, testUser.id);

        // # Open demo plugin channel
        cy.visit(`/${team2.name}/channels/demo_plugin`);

        // * Verify event is posted in the channel
        cy.findAllByTestId('postView').should('contain', `UserHasLeftTeam: @${testUser.username}`);
    });

    it('MM-T2408_8 - ​User user login Webhook event', () => {
        // # Login
        cy.apiLogin(testUser);

        // # Open demo plugin channel
        cy.visit(`/${team1.name}/channels/demo_plugin`);

        // * Verify event is posted in the channel
        cy.findAllByTestId('postView').should('contain', `User @${testUser.username} has logged in`);
    });

    it('MM-T2408_9 - ​User user created Webhook event', () => {
        // # Login
        cy.apiAdminLogin(admin);

        // # Create another user
        cy.apiCreateUser().then(({user: otherUser}) => {
            // # Open demo plugin channel
            cy.visit(`/${team1.name}/channels/demo_plugin`);

            // * Verify event is posted in the channel
            cy.findAllByTestId('postView').should('contain', `User_ID @${otherUser.id} has been created in`);
        });
    });
});
