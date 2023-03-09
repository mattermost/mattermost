// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @system_console @channel_moderation

import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {getRandomId} from '../../../../utils';
import {getAdminAccount} from '../../../../support/env';

import {checkboxesTitleToIdMap} from './constants';

import {
    deleteOrEditTeamScheme,
    disablePermission,
    enablePermission,
    goToPermissionsAndCreateTeamOverrideScheme,
    goToSystemScheme,
    saveConfigForChannel,
    saveConfigForScheme,
    visitChannel,
    visitChannelConfigPage,
} from './helpers';

describe('MM-23102 - Channel Moderation - Post Reactions', () => {
    let regularUser;
    let guestUser;
    let testTeam;
    let testChannel;
    const admin = getAdminAccount();

    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();

        cy.apiInitSetup().then(({team, channel, user}) => {
            regularUser = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateGuestUser().then(({guest}) => {
                guestUser = guest;

                cy.apiAddUserToTeam(testTeam.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, guestUser.id);
                });

                // Post a few messages in the channel
                visitChannel(admin, testChannel, testTeam);
                for (let i = 0; i < 3; i++) {
                    cy.postMessage(`test message ${Date.now()}`);
                }
            });
        });
    });

    it('MM-T1543 Post Reactions option for Guests', () => {
        visitChannelConfigPage(testChannel);

        // # Uncheck the post reactions option for Guests and save
        disablePermission(checkboxesTitleToIdMap.POST_REACTIONS_GUESTS);
        saveConfigForChannel();

        // # Login as a Guest user and visit the same channel
        visitChannel(guestUser, testChannel, testTeam);

        // # Check Guest user should not have the permission to react to any post on a channel when the option is removed.
        // * Guest user should not see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('not.exist');
        });

        // # Visit test channel configuration page and enable post reactions for guest and save
        visitChannelConfigPage(testChannel);
        enablePermission(checkboxesTitleToIdMap.POST_REACTIONS_GUESTS);
        saveConfigForChannel();

        visitChannel(guestUser, testChannel, testTeam);

        // # Check Guest user should have the permission to react to any post on a channel when the option is allowed.
        // * Guest user should see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('exist');
        });
    });

    it('MM-T1544 Post Reactions option for Members', () => {
        visitChannelConfigPage(testChannel);

        // # Uncheck the Create reactions option for Members and save
        disablePermission(checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS);
        saveConfigForChannel();

        // # Login as a Member user and visit the same channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member user should not have the permission to react to any post on a channel when the option is removed.
        // * Member user should not see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('not.exist');
        });

        // # Visit test Channel configuration page and enable post reactions for members and save
        visitChannelConfigPage(testChannel);
        enablePermission(checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS);
        saveConfigForChannel();

        // # Login as a Member user and visit the same channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member user should have the permission to react to any post on a channel when the option is allowed.
        // * Member user should see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('exist');
        });
    });

    it('MM-T1545 Post Reactions option removed for Guests and Members in System Scheme', () => {
        // # Login as sysadmin and visit the Permissions page in the system console.
        // # Edit the System Scheme and remove the Post Reaction option for Guests & Save.
        goToSystemScheme();
        cy.get('.guest').should('be.visible').within(() => {
            cy.findByText('Post Reactions').click();
        });
        saveConfigForScheme();

        // # Visit the Channels page and click on a channel.
        visitChannelConfigPage(testChannel);

        // * Assert that post reaction is disabled for guest and not disabled for members and a message is displayed
        cy.findByTestId('admin-channel_settings-channel_moderation-postReactions-disabledGuest').
            should('exist').
            and('have.text', 'Post reactions for guests are disabled in System Scheme.');
        cy.findByTestId(checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS).should('not.be.disabled');
        cy.findByTestId(checkboxesTitleToIdMap.POST_REACTIONS_GUESTS).should('be.disabled');

        // # Go to system admin page and then go to the system scheme and remove post reaction option for all members and save
        goToSystemScheme();
        cy.get('#all_users-posts-reactions').click();
        saveConfigForScheme();

        visitChannelConfigPage(testChannel);

        // * Post Reaction option should be disabled for a Members. A message Post reactions for guests & members are disabled in the System Scheme should be displayed.
        cy.findByTestId('admin-channel_settings-channel_moderation-postReactions-disabledBoth').
            should('exist').
            and('have.text', 'Post reactions for members and guests are disabled in System Scheme.');
        cy.findByTestId(checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS).should('be.disabled');
        cy.findByTestId(checkboxesTitleToIdMap.POST_REACTIONS_GUESTS).should('be.disabled');

        // # Login as a Guest user and visit the same channel
        visitChannel(guestUser, testChannel, testTeam);

        // # Check Guest User should not have the permission to react to any post on any channel when the option is removed from the System Scheme.
        // * Guest user should not see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('not.exist');
        });

        // # Login as a Member user and visit the same channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member should not have the permission to react to any post on any channel when the option is removed from the System Scheme.
        // * Member user should not see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('not.exist');
        });
    });

    // GUEST PERMISSIONS DON'T EXIST ON TEAM OVERRIDE SCHEMES SO GUEST PORTION NOT IMPLEMENTED!
    // ONLY THE MEMBERS PORTION OF THIS TEST IS IMPLEMENTED
    it('MM-T1546_4 Post Reactions option removed for Guests & Members in Team Override Scheme', () => {
        const teamOverrideSchemeName = `post_reactions_${getRandomId()}`;

        // # Create a new team override scheme
        goToPermissionsAndCreateTeamOverrideScheme(teamOverrideSchemeName, testTeam);

        visitChannelConfigPage(testChannel);

        // * Assert that post reaction is disabled for members
        cy.findByTestId(checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS).should('have.class', 'checkbox checked');

        // # Login as a Member user and visit the same channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member should have the permission to react to any post on any channel in that team
        // * User should see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('exist');
        });

        // # Go to system admin page and then go to the system scheme and remove post reaction option for all members and save
        deleteOrEditTeamScheme(teamOverrideSchemeName, 'edit');
        cy.get('#all_users-posts-reactions').click();
        saveConfigForScheme(false);

        // # Wait until the groups have been saved (since it redirects you)
        cy.wait(TIMEOUTS.ONE_SEC);

        visitChannelConfigPage(testChannel);

        // * Assert that post reaction is disabled for members
        cy.findByTestId(checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS).should('have.class', 'checkbox disabled');

        // # Login as a Member user and visit the same channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member should not have the permission to react to any post on any channel in that team
        // * User should not see the smiley face that allows a user to react to a post
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.findByTestId('post-reaction-emoji-icon').should('not.exist');
        });
    });
});
