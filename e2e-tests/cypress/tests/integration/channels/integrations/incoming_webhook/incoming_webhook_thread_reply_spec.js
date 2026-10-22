// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @incoming_webhook

import {getRandomId} from '@/utils';

describe('Incoming webhook', () => {
    let testTeam;
    let testChannel;
    let incomingWebhook;

    before(() => {
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook - thread reply',
                display_name: 'thread-reply',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });
        });
    });

    it('posts a webhook message as a reply when root_id references a thread root post', () => {
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        const rootMessage = `Root for webhook thread ${getRandomId()}`;

        // # Post a root message to open a thread
        cy.postMessage(rootMessage);

        cy.getLastPostId().then((rootPostId) => {
            const webhookReplyText = `Webhook thread reply ${getRandomId()}`;

            // # Post to the incoming webhook with root_id set to the thread root
            cy.postIncomingWebhook({
                url: incomingWebhook.url,
                data: {
                    text: webhookReplyText,
                    root_id: rootPostId,
                },
                waitFor: 'text',
            });

            cy.getLastPostId().then((replyId) => {
                // * Reply is stored as part of the thread (author-independent)
                cy.request({
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                    url: `/api/v4/posts/${replyId}`,
                }).then(({body: replyPost}) => {
                    expect(replyPost.root_id).to.eq(rootPostId);
                });

                // * Center-channel reply styling for threaded posts (CommentedOn is only shown when
                //   isFirstReply is true, which is false when the reply follows its root directly)
                cy.get(`#post_${replyId}`).
                    should('have.class', 'post--comment').
                    within(() => {
                        cy.get(`#postMessageText_${replyId}`).should('have.text', webhookReplyText);
                    });
            });
        });
    });
});
