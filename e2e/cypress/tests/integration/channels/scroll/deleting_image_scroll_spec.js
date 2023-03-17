// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @scroll

import {deletePostAndVerifyScroll, postListOfMessages, scrollCurrentChannelFromTop} from './helpers';

describe('Scroll', () => {
    let testChannelId;
    let testChannelLink;
    let mainUser;
    let otherUser;

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup().then(({user, team, channel}) => {
            mainUser = user;
            testChannelId = channel.id;
            testChannelLink = `/${team.name}/channels/${channel.name}`;
            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;
                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannelId, otherUser.id);
                });
            });
        });
    });

    it('MM-T2373_1 Post list does not scroll when the offscreen-above post with image attachment is deleted', () => {
        cy.apiLogin(otherUser);
        cy.visit(testChannelLink);

        // # Other user posts a messages with image attachment
        postMessageWithImageAttachment().then((attachmentPostId) => {
            // # Other user posts a few messages so that the first message is hidden
            postListOfMessages({sender: otherUser, channelId: testChannelId});

            cy.apiLogin(mainUser);
            cy.visit(testChannelLink);

            // # Main user scrolls to the top to load all the messages
            scrollCurrentChannelFromTop(0);

            // # Main user scrolls to the middle so that post with attachment is offscreen above
            scrollCurrentChannelFromTop('90%');

            // * Delete the message with image attachment, and verify that the channel did not scroll
            deletePostAndVerifyScroll(attachmentPostId, {user: otherUser});
        });
    });

    it('MM-T2373_2 Post list does not scroll when the offscreen-below post with image attachment is deleted', () => {
        cy.apiLogin(otherUser);
        cy.visit(testChannelLink);

        // # Other user posts a few messages so that the first message is hidden
        postListOfMessages({sender: otherUser, channelId: testChannelId});

        // # Other user posts a messages with image attachment
        postMessageWithImageAttachment().then((attachmentPostId) => {
            cy.apiLogin(mainUser);
            cy.visit(testChannelLink);

            // # Main user scrolls to the middle so that post with attachment is offscreen below
            scrollCurrentChannelFromTop('65%');

            // * Delete the message with image attachment, and verify that the channel did not scroll
            deletePostAndVerifyScroll(attachmentPostId, {user: otherUser});
        });
    });
});

function postMessageWithImageAttachment() {
    cy.get('#fileUploadInput').attachFile('huge-image.jpg');
    cy.postMessage('Bla-bla-bla');
    return cy.getLastPostId();
}
