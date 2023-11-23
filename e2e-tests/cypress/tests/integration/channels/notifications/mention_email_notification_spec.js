// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notification

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {
    FixedCloudConfig,
    getMentionEmailTemplate,
    verifyEmailBody,
} from '../../../utils';

describe('Email notification', () => {
    let config;
    let sender;
    let receiver;
    let testTeam;

    before(() => {
        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        // # Get config
        cy.apiGetConfig().then((data) => {
            ({config} = data);
        });

        cy.apiCreateUser().then(({user}) => {
            receiver = user;
        });

        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            sender = user;
            testTeam = team;

            cy.apiAddUserToTeam(team.id, receiver.id);

            // # Login and go to off-topic
            cy.apiLogin(sender);
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T4062 Post a message that mentions a user', () => {
        // # Post a message mentioning other user
        const message = `Hello @${receiver.username} `;
        cy.postMessage(message);

        // # Wait for a while to ensure that email notification is sent.
        cy.wait(TIMEOUTS.FIVE_SEC);

        cy.getLastPostId().then((postId) => {
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
                    message.trim(),
                    postId,
                    siteName,
                    testTeam.name,
                    'Off-Topic',
                );

                verifyEmailBody(expectedEmailBody, body);

                const permalink = body[3].split(' ')[4];
                const permalinkPostId = permalink.split('/')[6];

                // # Visit permalink (e.g. click on email link) then view in browser to proceed
                cy.visit(permalink);
                cy.findByText('View in Browser').click();

                const postText = `#postMessageText_${permalinkPostId}`;
                cy.get(postText).should('have.text', message);

                // * Should match last post and permalink post IDs
                expect(permalinkPostId).to.equal(postId);
            });
        });
    });
});
