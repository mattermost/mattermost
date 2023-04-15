// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @plugin @not_cloud

import * as MESSAGES from '../../../fixtures/messages';
import {matterpollPlugin} from '../../../utils/plugins';

describe('/poll', () => {
    let user1;
    let user2;
    let testChannelUrl;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            user1 = user;
            testChannelUrl = offTopicUrl;

            cy.apiCreateUser().then(({user: otherUser}) => {
                user2 = otherUser;

                cy.apiAddUserToTeam(team.id, user2.id);
            });
        });

        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
            },
        });

        // # Upload and enable "matterpoll" plugin
        cy.apiUploadAndEnablePlugin(matterpollPlugin);
    });

    beforeEach(() => {
        cy.apiLogout();
        cy.apiLogin(user1);
        cy.visit(testChannelUrl);
    });

    it('MM-T576_1 /poll', () => {
        // # In center post the following: /poll "Do you like https://mattermost.com?"
        cy.postMessage('/poll "Do you like https://mattermost.com?"');

        cy.uiGetPostBody().within(() => {
            // * Poll displays as expected in center
            cy.findByLabelText('matterpoll').should('be.visible');

            // * Mattermost URL renders as a live link
            cy.contains('a', 'https://mattermost.com').
                should('have.attr', 'href', 'https://mattermost.com');

            // # Click "Yes" or "No"
            cy.findByText('Yes').click();
        });

        // * After clicking Yes or No, ephemeral message displays "Your vote has been counted"
        cy.uiWaitUntilMessagePostedIncludes('Your vote has been counted.');

        // * If you go back and change your vote to another answer, ephemeral message displays "Your vote has been updated."
        cy.uiGetNthPost(-2).within(() => {
            cy.findByText('No').click();
        });
        cy.uiWaitUntilMessagePostedIncludes('Your vote has been updated');

        // # Click to reply on any message to open the RHS
        cy.postMessage(MESSAGES.SMALL);
        cy.clickPostCommentIcon();

        cy.uiGetRHS().within(() => {
            // # In RHS, post `/poll reply`
            cy.uiGetReplyTextBox().type('/poll reply');
            cy.findByTestId('SendMessageButton').click();

            // * Poll displays as expected in RHS.
            cy.findByLabelText('matterpoll').should('be.visible');
        });

        cy.apiLogout();
        cy.apiLogin(user2);
        cy.visit(testChannelUrl);

        // # Another user clicks Yes or No
        cy.uiGetNthPost(-3).within(() => {
            cy.findByText('No').click();
        });

        cy.apiLogout();
        cy.apiLogin(user1);
        cy.visit(testChannelUrl);
        cy.uiGetNthPost(-3).within(() => {
            cy.findByText('End Poll').click();
        });

        cy.findByText('End').click();

        // * Username displays the same on the original poll post and on the "This poll has ended" post
        cy.uiWaitUntilMessagePostedIncludes('The poll Do you like https://mattermost.com? has ended');
        cy.uiGetNthPost(-4).within(() => {
            cy.contains('This poll has ended').scrollIntoView().should('be.visible');
            cy.contains(user1.nickname);
        });
    });

    it('MM-T576_2 /poll', () => {
        // # Type and enter: `/poll "Q" "A1" "A2"`
        cy.postMessage('/poll "Q" "A1" "A2"');

        // # Click an answer option
        cy.uiGetPostBody().within(() => {
            cy.contains('Total votes: 0').should('be.visible');
            cy.findByText('A1').click();

            // * The vote count to go up
            cy.contains('Total votes: 1').should('be.visible');
        });

        //* User who voted sees a message that their vote was counted
        cy.uiWaitUntilMessagePostedIncludes('Your vote has been counted.');
    });

    it('MM-T576_3 /poll', () => {
        cy.postMessage('/poll "Do you like https://mattermost.com?"');
        cy.uiGetPostBody().within(() => {
            cy.findByText('Yes').click();
        });
        cy.apiLogout();
        cy.apiLogin(user2);
        cy.visit(testChannelUrl);
        cy.uiGetPostBody().within(() => {
            cy.findByText('Yes').click();
        });
        cy.apiLogout();
        cy.apiLogin(user1);
        cy.visit(testChannelUrl);
        cy.uiGetPostBody().within(() => {
            // # Click "End Poll"
            cy.findByText('End Poll').click();
        });
        cy.findByText('End').click();

        // * There is a message in the channel that the Poll has ended with a "here" link to view the responses
        cy.uiWaitUntilMessagePostedIncludes('The poll Do you like https://mattermost.com? has ended and the original post has been updated. You can jump to it by pressing here.');
        cy.uiGetPostBody().within(() => {
            cy.contains('a', 'here').click();
        });

        // * Clicking the link highlight the poll post in the center channel
        cy.uiGetNthPost(-2).scrollIntoView().
            should('have.class', 'post--highlight').
            within(() => {
                // * Users who voted are listed below the responses
                cy.findByText(`@${user1.username}`).should('be.visible');
                cy.findByText(`@${user2.username}`).should('be.visible');
            });
    });

    it('MM-T576_4 /poll', () => {
        // # Type and enter `/poll ":pizza:" ":thumbsup:" ":thumbsdown:"`
        cy.postMessage('/poll  ":pizza:" ":thumbsup:" ":thumbsdown:"');

        cy.uiGetPostBody().within(() => {
            // * Poll displays showing a slice of pizza emoji in place of the word "pizza"
            cy.get('h1 > span[data-emoticon="pizza"]').should('be.visible');
            cy.findByText('pizza').should('not.exist');

            // * Emoji for "thumbsup" and "thumbsdown" are shown in place of the words "yes" and "no"
            cy.get('button > span[data-emoticon="thumbsup"]').should('be.visible');
            cy.get('button > span[data-emoticon="thumbsdown"]').should('be.visible');
            cy.findByText('thumbsup').should('not.exist');
            cy.findByText('thumbsdown').should('not.exist');
        });
    });
});
