// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @notifications

import * as TIMEOUTS from '../../fixtures/timeouts';
import {
    FixedCloudConfig,
    getMentionEmailTemplate,
    verifyEmailBody,
} from '../../utils';

describe('Notifications', () => {
    let config;
    let sender;
    let testTeam;
    let testChannel;
    let testChannelUrl;
    let receiver;

    before(() => {
        cy.shouldHaveEmailEnabled();

        // # Get config
        cy.apiGetConfig().then((data) => {
            ({config} = data);
        });

        cy.apiInitSetup().then(({team, channel, user, channelUrl}) => {
            testTeam = team;
            testChannel = channel;
            testChannelUrl = channelUrl;
            sender = user;

            cy.apiCreateUser().then(({user: user1}) => {
                receiver = user1;
                cy.apiAddUserToTeam(testTeam.id, receiver.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, receiver.id);

                    // # Login as receiver and visit test channel
                    cy.apiLogin(receiver);
                    cy.visit(testChannelUrl);

                    // # Open 'Notifications' of 'Settings' modal
                    cy.uiOpenSettingsModal().within(() => {
                        // # Open 'Email Notifications' setting and set to 'Immediately'
                        cy.findByRole('heading', {name: 'Email Notifications'}).should('be.visible').click();
                        cy.findByRole('radio', {name: 'Immediately'}).click().should('be.checked');

                        // # Save then close the modal
                        cy.uiSaveAndClose();
                    });

                    // # As receiver, set status to offline and logout
                    cy.uiGetSetStatusButton().click();
                    cy.findByText('Offline').should('be.visible').click();
                    cy.apiLogout();

                    // # Login as sender and visit test channel
                    cy.apiLogin(sender);
                    cy.visit(testChannelUrl);
                });
            });
        });
    });

    it('MM-T506 Channel links show as links in notification emails', () => {
        const baseUrl = Cypress.config('baseUrl');
        const message = {
            orig: `This is a message in ~${testChannel.name} channel for @${receiver.username} `,
            emailLinked: `This is a message in ~${testChannel.name} ( ${baseUrl}/landing#/${testTeam.name}/channels/${testChannel.name} ) channel for @${receiver.username}`,
            posted: `This is a message in ~${testChannel.display_name} channel for @${receiver.username} `,
        };

        // # Post a message as sender that contains the channel name and receiver's username
        cy.postMessage(message.orig);

        // # Wait for a while to ensure that email notification is sent.
        cy.wait(TIMEOUTS.FIVE_SEC);

        cy.getLastPostId().then((postId) => {
            // # Login as the receiver and visit test channel
            cy.apiLogin(receiver);
            cy.visit(testChannelUrl);
            cy.get('#confirmModalButton').
                should('be.visible').
                and('have.text', 'Yes, set my status to "Online"').
                click();

            cy.getRecentEmail(receiver).then((data) => {
                const {body, from, subject} = data;
                const siteName = config.TeamSettings.SiteName;
                const feedbackEmail = config.EmailSettings.FeedbackEmail || FixedCloudConfig.EmailSettings.FEEDBACK_EMAIL;

                // * Verify that email is from default feedback email
                expect(from).to.contain(feedbackEmail);

                // * Verify that the email subject is correct
                expect(subject).to.contain(`[${siteName}] Notification in ${testTeam.display_name}`);

                // * Verify that the email body is correct
                const expectedEmailBody = getMentionEmailTemplate(
                    sender.username,
                    message.emailLinked,
                    postId,
                    siteName,
                    testTeam.name,
                    testChannel.display_name,
                );
                verifyEmailBody(expectedEmailBody, body);

                const permalink = body[3].split(' ')[4];
                const permalinkPostId = permalink.split('/')[6];

                // # Visit permalink (e.g. click on email link) then view in browser to proceed
                cy.visit(permalink);
                cy.findByText('View in Browser').click();

                // * Verify that message is correct
                const postText = `#postMessageText_${permalinkPostId}`;
                cy.get(postText).should('have.text', message.posted);

                // * Should match last post and permalink post IDs
                expect(permalinkPostId).to.equal(postId);
            });
        });
    });
});
