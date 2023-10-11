// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });
        });
    });

    it('MM-T1235 Arrow up key - no Edit modal open up if user has not posted any message yet', () => {
        const message2 = 'Test message from User 2';

        cy.apiLogin(otherUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 2
        cy.postMessage(message2);
        cy.apiLogout();

        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Press UP arrow
        cy.uiGetPostTextBox().type('{uparrow}');

        // * Verify that Edit modal should not be visible
        cy.get('#edit_textbox').should('not.exist');
    });

    it('MM-T1236 Arrow up key - Edit Input opens up for own message of a user', () => {
        const message1 = 'Test message from User 1';
        const message2 = 'Test message from User 2';

        cy.apiLogin(testUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 1
        cy.postMessage(message1);
        cy.apiLogout();

        cy.apiLogin(otherUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 2
        cy.postMessage(message2);
        cy.apiLogout();

        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Press UP arrow
        cy.uiGetPostTextBox().type('{uparrow}');

        // * Verify that the Edit Post Input is visible
        cy.get('#edit_textbox').should('be.visible');

        // * Verify that the Edit textbox contains previously sent message by user 1
        cy.get('#edit_textbox').should('have.text', message1);
    });

    it('MM-T1271_1 UP - Removing all text in edit deletes post if without attachment', () => {
        const message = 'Message to be deleted';
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message
        cy.postMessage(message);
        cy.uiWaitUntilMessagePostedIncludes(message);

        cy.getLastPostId().then((postID) => {
            // * Verify that testuser sees post
            cy.get(`#postMessageText_${postID}`).should('contain', message);

            cy.uiGetPostTextBox().type('{uparrow}');

            // * Validate that edit box contains just posted message
            cy.get('#edit_textbox').should('have.text', message);

            // # Clear all text, delete and confirm by pressing enter
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('#edit_textbox').clear().type('{enter}');

            // * Verify confirm modal is shown
            cy.findByRole('dialog', {name: 'Confirm Post Delete'}).should('be.visible');

            // # Press enter on confirm dialog
            cy.uiGetButton('Delete').click();

            // * Verify post is deleted
            cy.get(`#postMessageText_${postID}`).should('not.exist');
        });

        // # Post message as other user
        cy.postMessageAs({sender: otherUser, message, channelId: testChannel.id});
        cy.uiWaitUntilMessagePostedIncludes(message);
        cy.getLastPostId().then((postID) => {
            cy.get(`#postMessageText_${postID}`).should('contain', message);

            // # Delete message as test user
            cy.externalRequest({user: otherUser, method: 'DELETE', path: `posts/${postID}`});

            // * Verify that other user sees that message is deleted
            cy.get(`#post_${postID} #${postID}_message`).should('have.text', '(message deleted)');
        });
    });

    it('MM-T1271_2 UP - Removing all text in edit does not delete post if with attachment', () => {
        const message = 'This is a message';
        const filename = 'mattermost-icon.png';
        cy.apiLogin(testUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message with attachment
        cy.get('#fileUploadInput').attachFile(filename);
        cy.postMessage(message);

        // * Verify that the message and file attachment is posted
        cy.uiWaitUntilMessagePostedIncludes(message);
        cy.uiGetFileThumbnail(filename).should('be.visible');

        // # Press up arrow
        cy.uiGetPostTextBox().type('{uparrow}');
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Clear all text and confirm
        cy.get('#edit_textbox').clear().type('{enter}');

        // * Delete post confirm modal should not exist
        cy.get('#deletePostModal').should('not.exist');

        // * Verify that attachment is still visible
        cy.uiGetFileThumbnail(filename).should('be.visible');

        // * Post should contain edited tag
        cy.getLastPostId().then((postId) => {
            // * Post should have "Edited"
            cy.get(`#postEdited_${postId}`).
                should('be.visible').
                should('contain', 'Edited');
        });

        // # Login with other user
        cy.apiLogout();
        cy.apiLogin(otherUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Verify that attachment is still visible
        cy.uiGetFileThumbnail(filename).should('be.visible');

        // * Post should contain edited tag
        cy.getLastPostId().then((postId) => {
            // * Post should have "Edited"
            cy.get(`#postEdited_${postId}`).
                should('be.visible').
                should('contain', 'Edited');
        });
    });

    it('MM-T1272 Arrow up key - Removing all text in edit deletes reply', () => {
        const message = 'Test message from User 1';
        const reply = 'Reply from User 1';

        cy.apiLogin(testUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 1
        cy.postMessage(message);

        // # Reply to message
        cy.getLastPostId().then((postId) => {
            cy.clickPostCommentIcon(postId);
            cy.postMessageReplyInRHS(reply);
        });

        cy.getLastPostId().then((postID) => {
            // # Press UP arrow
            cy.uiGetPostTextBox().type('{uparrow}');

            cy.wait(TIMEOUTS.HALF_SEC);

            // # Clear message and type ENTER
            cy.get('#edit_textbox').clear().type('{enter}');

            // * Delete post confirmation modal should be visible
            cy.get('#deletePostModal').should('be.visible');

            // # Confirm delete
            cy.get('#deletePostModalButton').click();

            // * Assert post message disappears
            cy.get(`#postMessageText_${postID}`).should('not.exist');
        });
    });

    it('MM-T1269 Arrow up key - Edit code block', () => {
        const messageWithCodeblock1 = '```{shift}{enter}codeblock1{shift}{enter}```{shift}{enter}';
        const messageWithCodeblock2 = '```{shift}{enter}codeblock2{shift}{enter}```{shift}{enter}';

        cy.apiLogin(testUser);

        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post code block message from User 1
        cy.uiGetPostTextBox().type(messageWithCodeblock1).type('{enter}');

        cy.uiWaitUntilMessagePostedIncludes('codeblock1');

        // # Press UP arrow
        cy.uiGetPostTextBox().type('{uparrow}');

        // # Edit text
        cy.get('#edit_textbox').clear().type(messageWithCodeblock2).type('{enter}');

        // * Verify that the message was edited
        cy.uiWaitUntilMessagePostedIncludes('codeblock2');
    });

    it('MM-T1264 Arrow up key - Ephemeral message does not open for edit; opens previous regular message', () => {
        // # Type user message
        const message = 'Hello World';
        cy.postMessage(message);

        // # Type "/code" with no text to receive ephemeral message
        cy.postMessage('/code ');

        // * Verify if an ephemeral message was received
        cy.findByText('(Only visible to you)').should('exist');
        cy.findByText('A message must be provided with the /code command.').should('exist');

        // # Press up arrow key
        cy.get('body').type('{uparrow}');

        // * Verify that the Edit Post Input is visible
        cy.get('#edit_textbox').should('be.visible');

        // * Verify that edit box have value of previous regular message
        cy.get('#edit_textbox').should('have.value', message);
    });

    it('MM-T1270 UP - Edit message with attachment but no text', () => {
        cy.apiLogin(testUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Upload file
        cy.get('#fileUploadInput').attachFile('mattermost-icon.png');

        // # Wait for file to upload
        cy.wait(TIMEOUTS.TWO_SEC);

        cy.uiGetPostTextBox().type('{enter}');

        cy.getLastPost().within(() => {
            // * Attachment should exist
            cy.get('.file-view--single').should('exist');

            // * Edited indicator should not exist
            cy.get('.post-edited__indicator').should('not.exist');
        });

        // # Press UP arrow
        cy.uiGetPostTextBox().type('{uparrow}');

        // # Add some text to the previous message and save
        cy.get('#edit_textbox').type('Test').type('{enter}');
        cy.wait(TIMEOUTS.ONE_SEC);

        cy.getLastPost().within(() => {
            // * Posted message should be correct
            cy.get('.post-message__text').should('contain.text', 'Test');

            // * Attachment should exist
            cy.get('.file-view--single').should('exist');

            // * Edited indicator should exist
            cy.get('.post-edited__indicator').should('exist');
        });
    });
});
