// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {
    enablePermission,
    goToSystemScheme,
    saveConfigForScheme,
} from '../../enterprise/system_console/channel_moderation/helpers';

import {addNewCommand, runSlashCommand} from './helpers';

describe('Slash commands', () => {
    const trigger = 'my_trigger';
    let user1;
    let user2;
    let team1;
    let commandURL;
    const userIds = [];
    let groupChannel;
    let visitLink;

    before(() => {
        cy.requireWebhookServer();
        cy.apiInitSetup().then(({team, user}) => {
            user1 = user;
            team1 = team;

            cy.apiGetChannelByName(team.name, 'town-square').then(({channel}) => {
                commandURL = `${Cypress.env().webhookBaseUrl}/send_message_to_channel?channel_id=${channel.id}`;
            });

            // # Create a GM with at least 3 users
            ['charlie', 'diana', 'eddie'].forEach((name) => {
                cy.apiCreateUser({prefix: name, bypassTutorial: true}).then(({user: groupUser}) => {
                    cy.apiAddUserToTeam(team1.id, groupUser.id);
                    userIds.push(groupUser.id);
                });
            });

            // # Add test user to the list of group members
            userIds.push(user1.id);

            cy.apiCreateGroupChannel(userIds).then(({channel}) => {
                groupChannel = channel;
            });

            cy.apiCreateUser().then(({user: otherUser}) => {
                user2 = otherUser;
                cy.apiAddUserToTeam(team.id, user2.id);
            });
        });
    });

    it('MM-T669 Custom slash command in DM and GM', () => {
        const gmTrigger = 'gm_trigger';
        const dmTrigger = 'dm_trigger';

        cy.apiAdminLogin(user1);
        cy.apiGetChannelByName(team1.name, groupChannel.name).then(({channel}) => {
            const customGMUrl = `${Cypress.env().webhookBaseUrl}/send_message_to_channel?channel_id=${channel.id}`;

            // # Add a new command to send a GM
            addNewCommand(team1, gmTrigger, customGMUrl);

            visitLink = `/${team1.name}/channels/${groupChannel.name}`;

            // * Verify running custom command in GM
            runSlashCommand(visitLink, gmTrigger);

            // # Cleanup command
            deleteCommand(team1, gmTrigger);
        });

        // # Create a new DM channel
        cy.apiCreateDirectChannel([user1.id, user2.id]).then(() => {
            visitLink = `/${team1.name}/messages/@${user2.username}`;
            cy.visit(visitLink);
        });

        // # Get channel id to create a custom slash command in DM
        cy.getCurrentChannelId().then((channelId) => {
            const message = `hello from ${user2.username}: ${Date.now()}`;
            cy.postMessageAs({sender: user2, message, channelId});

            const customDMUrl = `${Cypress.env().webhookBaseUrl}/send_message_to_channel?channel_id=${channelId}`;

            addNewCommand(team1, dmTrigger, customDMUrl);

            // * Verify running custom command in DM
            runSlashCommand(visitLink, dmTrigger);

            // # Cleanup command
            deleteCommand(team1, dmTrigger);
        });
    });

    it('MM-T696 Can\'t delete other user\'s slash command', () => {
        cy.apiAdminLogin(user1);

        // # Create new Slash command
        addNewCommand(team1, trigger, 'http://dot.com');

        goToSystemScheme();
        enablePermission('all_users-integrations-manage_slash_commands-checkbox');
        saveConfigForScheme();

        // # Login as another user
        cy.apiLogin(user2);

        // # Open slash command page
        cy.visit(`/${team1.name}/integrations/commands/installed`);

        // * Verify slash command exists
        cy.contains(`/${trigger}`);

        // * Verify that Edit and Delete options do not show up
        cy.contains('Edit').should('not.exist');
        cy.contains('Delete').should('not.exist');

        // # Cleanup command
        cy.apiAdminLogin(user1);
        deleteCommand(team1, trigger);
    });

    it('MM-T697 Delete slash command', () => {
        // # Create new Slash command
        addNewCommand(team1, trigger, 'http://dot.com');

        deleteCommand(team1, trigger);

        // # Go back to home channel
        cy.visit(`/${team1.name}/channels/town-square`);

        // # Run slash command
        cy.uiGetPostTextBox().clear().type(`/${trigger} {enter}`);
        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify error
        cy.findByText(`Command with a trigger of '/${trigger}' not found.`).should('exist').and('be.visible');
    });

    it('MM-T700 Slash command - Override username', () => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostUsernameOverride: true,
            },
        });

        // # Create new Slash command
        addNewCommand(team1, trigger, commandURL);

        // # Open slash command page
        cy.visit(`/${team1.name}/integrations/commands/installed`);

        // # Update username
        // # click on last added command's(first child) edit action
        cy.get('.backstage-list').find('.backstage-list__item').first().findByText('Edit').click();
        cy.get('#username').type('newname');
        cy.get('#saveCommand').click();

        // # Go back to home channel
        cy.visit(`/${team1.name}/channels/town-square`);

        // # Run slash command
        cy.postMessage(`/${trigger} `);
        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify that last post is by newname
        cy.getLastPost().within(() => {
            cy.get('.post__header').find('.user-popover').as('usernameForPopover').should('have.text', 'newname');
        });

        // # Cleanup command
        deleteCommand(team1, trigger);
    });

    it('MM-T701 Slash command - Override profile picture', () => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostIconOverride: true,
            },
        });

        // # Create new Slash command
        addNewCommand(team1, trigger, commandURL);

        // # Open slash command page
        cy.visit(`/${team1.name}/integrations/commands/installed`);

        // # Update icon URL
        // # click on last added command's(first child) edit action
        cy.get('.backstage-list').find('.backstage-list__item').first().findByText('Edit').click();
        const iconURL = 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png';
        cy.get('#iconUrl').type(iconURL);
        cy.get('#saveCommand').click();

        // # Go back to home channel
        cy.visit(`/${team1.name}/channels/town-square`);

        // # Run slash command
        cy.postMessage(`/${trigger} `);
        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify that last post has correct icon
        cy.getLastPost().within(() => {
            const baseUrl = Cypress.config('baseUrl');
            const encodedIconUrl = encodeURIComponent(iconURL);
            cy.get('.profile-icon > img').as('profileIconForPopover').should('have.attr', 'src', `${baseUrl}/api/v4/image?url=${encodedIconUrl}`);
        });

        // # Cleanup command
        deleteCommand(team1, trigger);
    });

    it('MM-T703 Show custom slash command in autocomplete', () => {
        // # Create new Slash command
        addNewCommand(team1, trigger, commandURL);

        // # Open slash command page
        cy.visit(`/${team1.name}/integrations/commands/installed`);

        // # Update autocomplete
        // # click on last added command's(first child) edit action
        cy.get('.backstage-list').find('.backstage-list__item').first().findByText('Edit').click();
        cy.get('#autocomplete').click();
        const hint = '[test-hint]';
        cy.get('#autocompleteHint').type(hint);
        const desc = 'Auto description';

        // since there are two selectors with the same id 'description' we pick one which is the 10-th child
        cy.get(':nth-child(10) > .col-md-5 > #description').type(desc);
        cy.get('#saveCommand').click();

        // # Go back to home channel
        cy.visit(`/${team1.name}/channels/town-square`);

        // # Type slash
        cy.uiGetPostTextBox().clear().type('/');
        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify that command is in the list
        cy.contains(trigger);

        // # Type full command
        cy.uiGetPostTextBox().type(trigger);
        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify that autocomplete info is correct
        cy.get('.slash-command__title').should('have.text', `${trigger} ${hint}`);
        cy.get('.slash-command__desc').should('have.text', `${desc}`);

        // # Open slash command page
        cy.visit(`/${team1.name}/integrations/commands/installed`);

        // # Remove autocomplete
        // # click on last added command's(first child) edit action
        cy.get('.backstage-list').find('.backstage-list__item').first().findByText('Edit').click();
        cy.get('#autocomplete').click();
        cy.get('#saveCommand').click();

        // # Go back to home channel
        cy.visit(`/${team1.name}/channels/town-square`);

        // # Run slash command
        cy.uiGetPostTextBox().clear().type('/');
        cy.wait(TIMEOUTS.TWO_SEC);

        // * Verify that command is not in the list
        cy.contains(trigger).should('not.exist');

        // # Cleanup command
        deleteCommand(team1, trigger);
    });
});

function deleteCommand(team, trigger) {
    // # Open slash command page
    cy.visit(`/${team.name}/integrations/commands/installed`);

    // # Delete slash command
    // * Verify that last added command's details contains `/trigger`
    cy.get('.backstage-list').find('.backstage-list__item').first().findByText(`- /${trigger}`).should('be.visible');

    // # Click on last added command's delete action
    cy.get('.backstage-list').find('.backstage-list__item').first().findByText('Delete').click();
    cy.get('#confirmModalButton').click();

    // * Verify slash command no longer displays in list
    cy.get('.backstage-list').find('.backstage-list__item').first().findByText(`- /${trigger}`).should('not.exist');
}
