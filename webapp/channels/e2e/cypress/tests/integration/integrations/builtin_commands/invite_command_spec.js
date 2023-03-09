// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {loginAndVisitChannel} from './helper';

describe('Integrations', () => {
    let testUser;
    let testTeam;
    const userGroup = [];
    let testChannel;
    let testChannelUrl;
    let offTopicUrl;

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl: url}) => {
            testUser = user;
            testTeam = team;
            offTopicUrl = url;

            Cypress._.times(8, () => {
                cy.apiCreateUser().then(({user: otherUser}) => {
                    cy.apiAddUserToTeam(team.id, otherUser.id);
                    userGroup.push(otherUser);
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            testChannel = channel;
            testChannelUrl = `/${testTeam.name}/channels/${channel.name}`;
            cy.apiAddUserToChannel(channel.id, testUser.id);
        });
    });

    it('MM-T658 /invite - current channel', () => {
        cy.apiCreateUser().then(({user}) => {
            return cy.apiDeactivateUser(user.id).then(() => user);
        }).then((deactivatedUser) => {
            const userToInvite = userGroup[0];

            loginAndVisitChannel(testUser, testChannelUrl);

            // # Post `/invite @username` where username is a user who is not in the current channel
            cy.postMessage(`/invite @${userToInvite.username} `);

            // * User who added them sees system message "username added to the channel by you"
            cy.uiWaitUntilMessagePostedIncludes(`@${userToInvite.username} added to the channel by you`);

            // * Cannot invite deactivated users to a channel
            cy.postMessage(`/invite @${deactivatedUser.username} `);
            cy.uiWaitUntilMessagePostedIncludes(`We couldn't find the user ${deactivatedUser.username}. They may have been deactivated by the System Administrator.`);

            cy.apiLogout();
            loginAndVisitChannel(userToInvite, offTopicUrl);

            // * Added user sees channel added to LHS, mention badge
            cy.uiGetLhsSection('CHANNELS').
                findByLabelText(`${testChannel.display_name.toLowerCase()} public channel 1 mention`).
                should('be.visible').
                click();

            // * Added user sees system message "username added to the channel by username."
            cy.uiWaitUntilMessagePostedIncludes(`You were added to the channel by @${testUser.username}`);
        });
    });

    it('MM-T661 /invite extra white space before @ in DM or GM', () => {
        const [member1, member2, userToInviteGM, userToInviteDM] = userGroup;

        loginAndVisitChannel(testUser, testChannelUrl);

        // # In a GM use the /invite command to invite a user to a channel you have permission to add them to but place extra white space before the username
        cy.postMessage(`/groupmsg @${member1.username} @${member2.username} `);
        cy.postMessage(`/invite        @${userToInviteGM.username} ~${testChannel.name} `);

        // * User added to channel as expected
        cy.uiWaitUntilMessagePostedIncludes(`${userToInviteGM.username} added to ${testChannel.name} channel.`);

        cy.uiAddDirectMessage().click();
        cy.get('#selectItems input').typeWithForce(userToInviteDM.username).wait(TIMEOUTS.ONE_SEC);
        cy.get('#multiSelectList').findByText(`@${userToInviteDM.username}`).click();
        cy.findByText('Go').click();
        cy.uiGetChannelHeaderButton().contains(userToInviteDM.username);

        // # In a DM use the /invite command to invite a user to a channel you have permission to add them to but place extra white space before the username
        cy.postMessage(`/invite        @${userToInviteDM.username} ~${testChannel.name} `);

        // * User added to channel as expected
        cy.uiWaitUntilMessagePostedIncludes(`${userToInviteDM.username} added to ${testChannel.name} channel.`);
    });

    it('MM-T659 /invite - other channel', () => {
        const userToInvite = userGroup[0];

        loginAndVisitChannel(testUser, offTopicUrl);

        // # Post `/invite @username ~channel` where channel name is a channel you have permission to add members to but not the current channel, and username is a user not in that other channel
        cy.postMessage(`/invite @${userToInvite.username} ~${testChannel.name} `);

        // * User who added them sees system message "username added to channel."
        cy.uiWaitUntilMessagePostedIncludes(`${userToInvite.username} added to ${testChannel.name} channel.`);

        cy.apiLogout();
        loginAndVisitChannel(userToInvite, offTopicUrl);

        // * Added user sees channel added to LHS, mention badge.
        cy.uiGetLhsSection('CHANNELS').
            findByLabelText(`${testChannel.display_name.toLowerCase()} public channel 1 mention`).
            should('be.visible').
            click();

        // * Added user sees system message "username added to the channel by username."
        cy.uiWaitUntilMessagePostedIncludes(`You were added to the channel by @${testUser.username}`);
    });

    it('MM-T660_1 /invite tests when used in DMs and GMs', () => {
        const [member1, member2, userDM] = userGroup;

        loginAndVisitChannel(testUser, testChannelUrl);

        // # In a GM Use the /invite command to invite a channel to another channel (e.g., /invite @[channel name])
        cy.postMessage(`/groupmsg @${member1.username} @${member2.username} `);
        cy.postMessage(`/invite @${testChannel.name} `);

        // * Error appears: "We couldn't find the user. They may have been deactivated by the System Administrator."
        cy.uiWaitUntilMessagePostedIncludes(`We couldn't find the user ${testChannel.name}. They may have been deactivated by the System Administrator.`);

        cy.uiAddDirectMessage().click();
        cy.get('#selectItems input').typeWithForce(userDM.username).wait(TIMEOUTS.ONE_SEC);
        cy.get('#multiSelectList').findByText(`@${userDM.username}`).click();
        cy.findByText('Go').click();
        cy.uiGetChannelHeaderButton().contains(userDM.username);

        // # In a GM Use the /invite command to invite a channel to another channel (e.g., /invite @[channel name])
        cy.postMessage(`/invite @${testChannel.name} `);

        // * Error appears: "We couldn't find the user. They may have been deactivated by the System Administrator."
        cy.uiWaitUntilMessagePostedIncludes(`We couldn't find the user ${testChannel.name}. They may have been deactivated by the System Administrator.`);
    });

    it('MM-T660_2 /invite tests when used in DMs and GMs', () => {
        const [member1, member2, userDM, userToInvite] = userGroup;

        cy.apiAddUserToChannel(testChannel.id, userToInvite.id);
        loginAndVisitChannel(testUser, testChannelUrl);

        // # In a GM use the /invite command to invite someone to a channel they're already a member of
        cy.postMessage(`/groupmsg @${member1.username} @${member2.username} `);
        cy.postMessage(`/invite @${userToInvite.username} ~${testChannel.name} `);

        // * Error appears: "[username] is already in the channel"
        cy.uiWaitUntilMessagePostedIncludes(`${userToInvite.username} is already in the channel.`);

        cy.uiAddDirectMessage().click();
        cy.get('#selectItems input').typeWithForce(userDM.username).wait(TIMEOUTS.ONE_SEC);
        cy.get('#multiSelectList').findByText(`@${userDM.username}`).click();
        cy.findByText('Go').click();
        cy.uiGetChannelHeaderButton().contains(userDM.username);

        // # In a DM use the /invite command to invite someone to a channel they're already a member of
        cy.postMessage(`/invite @${userToInvite.username} ~${testChannel.name} `);

        // * Error appears: "[username] is already in the channel"
        cy.uiWaitUntilMessagePostedIncludes(`${userToInvite.username} is already in the channel.`);
    });

    it('MM-T660_3 /invite tests when used in DMs and GMs', () => {
        const [userA, userB, userC, userDM, member1, member2] = userGroup;

        // # As UserA create a new public channel
        loginAndVisitChannel(testUser, offTopicUrl);
        cy.uiCreateChannel({name: `${userA.username}-channel`});
        cy.get('#postListContent').should('be.visible');

        cy.apiLogout();
        loginAndVisitChannel(userB, offTopicUrl);

        cy.uiAddDirectMessage().click();
        cy.get('#selectItems input').typeWithForce(userDM.username).wait(TIMEOUTS.ONE_SEC);
        cy.get('#multiSelectList').findByText(`@${userDM.username}`).click();
        cy.findByText('Go').click();
        cy.uiGetChannelHeaderButton().contains(userDM.username);

        // # As UserB use the /invite command in a DM to invite UserC to the public channel that UserB is not a member of
        cy.postMessage(`/invite @${userC.username} ~${userA.username}-channel `);

        // * Error appears: "You don't have enough permissions to add [username] in [public channel name]."
        cy.uiWaitUntilMessagePostedIncludes(`You don't have enough permissions to add ${userC.username} in ${userA.username}-channel.`);

        // # As UserB use the /invite command in a GM to invite UserC to the public channel that UserB is not a member of
        cy.postMessage(`/groupmsg @${member1.username} @${member2.username} `);
        cy.postMessage(`/invite @${userC.username} ~${userA.username}-channel `);

        // * Error appears: "You don't have enough permissions to add [username] in [public channel name]."
        cy.uiWaitUntilMessagePostedIncludes(`You don't have enough permissions to add ${userC.username} in ${userA.username}-channel.`);
    });

    it('MM-T660_4 /invite tests when used in DMs and GMs', () => {
        const userToInvite = userGroup[0];

        loginAndVisitChannel(testUser, offTopicUrl);

        // # Use the /invite command to invite a user to a channel by typing the channel name out without the tilde (~).
        cy.postMessage(`/invite @${userToInvite.username} ${testChannel.display_name} `);

        // * Error appears: "Could not find the channel [channel name]. Please use the channel handle to identify channels."
        cy.uiWaitUntilMessagePostedIncludes(`Could not find the channel ${testChannel.display_name.split(' ')[1]}. Please use the channel handle to identify channels.`);

        // * "channel handle" is a live link to https://docs.mattermost.com/messaging/managing-channels.html#naming-a-channel
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).
                contains('a', 'channel handle').should('have.attr', 'href', 'https://docs.mattermost.com/messaging/managing-channels.html#naming-a-channel');
        });
    });
});
