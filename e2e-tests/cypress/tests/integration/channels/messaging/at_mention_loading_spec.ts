// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAdminAccount} from '../../../../tests/support/env';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

describe('loading of at-mentioned users', () => {
    const admin = getAdminAccount();

    let testChannel;

    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({channel, channelUrl}) => {
            testChannel = channel;

            cy.visit(channelUrl);

            // # Wait for the channel to visibly load
            cy.findByText('Write to ' + testChannel.display_name);
        });
    });

    it('should load a user who joins the channel', () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin add them to the team and channel
            cy.externalAddUserToTeam(otherUser.id, testChannel.team_id);
            cy.externalAddUserToChannel(otherUser.id, testChannel.id);

            // * Wait for the system message at-mentioning that user to know that they've been loaded
            cy.contains('a', '@' + otherUser.username).should('be.visible');
        });
    });

    it('should load a user who posts in the channel', () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // # Make the new user into an admin so that they can post without joining the channel to simulate
            // someone posting in the channel for the first time in a long time
            cy.externalUpdateUserRoles(otherUser.id, 'system_user system_admin');

            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Make a post as the other user
            cy.externalCreatePostAsUser(otherUser, {
                channel_id: testChannel.id,
                message: 'This is a post',
            }).then((post) => {
                cy.findByText(post.message).should('be.visible');
                cy.get(`#${post.id}_message`).should('be.visible');
            });

            // * Wait for the user's name to know that they've been loaded
            cy.contains('button.user-popover', otherUser.username).should('be.visible');
        });
    });

    it("should load a user who's been at-mentioned in a post", () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin at-mention the new user
            cy.externalCreatePostAsUser(admin, {
                channel_id: testChannel.id,
                message: `Created @${otherUser.username}`,
            });

            // * Confirm that the at-mention renders as a link
            cy.contains('a', '@' + otherUser.username).should('be.visible');
        });
    });

    it("should load a user who's been at-mentioned in a message attachment's text", () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin at-mention the new user
            cy.externalCreatePostAsUser(admin, {
                channel_id: testChannel.id,
                props: {
                    attachments: [
                        {text: `Ticket updated by @${otherUser.username}`},
                    ],
                },
            });

            // * Confirm that the at-mention renders as a link
            cy.contains('a', '@' + otherUser.username).should('be.visible');
        });
    });

    it("should load a user who's been at-mentioned in a message attachment's pretext", () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin at-mention the new user
            cy.externalCreatePostAsUser(admin, {
                channel_id: testChannel.id,
                props: {
                    attachments: [
                        {pretext: `@${otherUser.username} created a ticket`, text: 'Ticket #123 - Fix some bug'},
                    ],
                },
            });

            // * Confirm that the at-mention renders as a link
            cy.contains('a', '@' + otherUser.username).should('be.visible');
        });
    });

    it("should not load a user who's been at-mentioned in a message attachment's title", () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin at-mention the new user
            cy.externalCreatePostAsUser(admin, {
                channel_id: testChannel.id,
                props: {
                    attachments: [
                        {title: `@${otherUser.username}'s ticket`, text: 'TODO'},
                    ],
                },
            });

            // * Confirm that the attachment title doesn't render as a link
            cy.contains('h1', `@${otherUser.username}'s ticket`).should('be.visible');
        });
    });

    it("should not load a user who's been at-mentioned in a message attachment's field's title", () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin at-mention the new user
            cy.externalCreatePostAsUser(admin, {
                channel_id: testChannel.id,
                props: {
                    attachments: [
                        {
                            title: 'Ticket created',
                            fields: [
                                {title: `Note from @${otherUser.username}`, value: 'Something happened'},
                            ],
                        },
                    ],
                },
            });

            // * Confirm that the field title doesn't render as a link
            cy.contains('th', `Note from @${otherUser.username}`).should('be.visible');
        });
    });

    it("should load a user who's been at-mentioned in a message attachment's field's value", () => {
        cy.externalCreateUser({}).then((otherUser) => {
            // * The new user shouldn't be loaded because the current user hasn't seen them yet
            assertUserNotLoaded(otherUser.id);

            // # Have the admin at-mention the new user
            cy.externalCreatePostAsUser(admin, {
                channel_id: testChannel.id,
                props: {
                    attachments: [
                        {
                            title: 'Ticket created',
                            fields: [
                                {title: 'Assignee', value: `Created @${otherUser.username}`},
                            ],
                        },
                    ],
                },
            });

            // * Confirm that the at-mention renders as a link
            cy.contains('a', '@' + otherUser.username).should('be.visible');
        });
    });
});

function assertUserNotLoaded(userId: string) {
    cy.window().then((win) => {
        const state = (win as any).store.getState();

        cy.wrap(state.entities.users.profiles[userId]).should('be.undefined');
    });
}
