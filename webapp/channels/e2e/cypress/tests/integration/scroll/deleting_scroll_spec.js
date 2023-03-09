// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @scroll

import {deletePostAndVerifyScroll, postListOfMessages, scrollCurrentChannelFromTop} from './helpers';

describe('Scroll', () => {
    let testChannelId;
    let testChannelLink;
    let otherUser;

    const multilineString = `A
    multiline
    message`;

    before(() => {
        cy.apiInitSetup().then(({team, channel}) => {
            testChannelId = channel.id;
            testChannelLink = `/${team.name}/channels/${channel.name}`;
            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;
                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannelId, otherUser.id);
                });
            });
            cy.visit(testChannelLink);
        });
    });

    it('MM-T2372 Post list does not scroll when the offscreen post is deleted', () => {
        // # Other user posts a multiline message
        cy.postMessageAs({sender: otherUser, message: multilineString, channelId: testChannelId});

        cy.getLastPostId().then((multilineMessageID) => {
            // # Main user posts a few messages so that the first message is hidden
            postListOfMessages({sender: otherUser, channelId: testChannelId});

            // # Main user scrolls to the middle so that multiline post is offscreen
            scrollCurrentChannelFromTop('100%');

            // * Delete the multiline message and verify that the channel did not scroll
            deletePostAndVerifyScroll(multilineMessageID, {user: otherUser});
        });
    });
});
