// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    let testUser;
    let otherUser;

    const count = 3;
    const teamAndChannels = [];

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, otherUser.id);

                    cy.apiLogin(testUser);

                    Cypress._.times(1, (i) => {
                        cy.apiCreateTeam(`team${i}`, `Team${i}`).then(({team: testTeam}) => {
                            teamAndChannels.push({team: testTeam, channels: []});
                            const channelName = `channel${i}`;
                            const channelDisplayName = `Channel${i}`;

                            Cypress._.times(count, (j) => {
                                cy.apiCreateChannel(testTeam.id, channelName + j, channelDisplayName + j).then(({channel: testChannel}) => {
                                    teamAndChannels[i].channels.push(testChannel);
                                    cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                                        cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
    });

    it('MM-T3002 CTRL/CMD+K - Unread Channels and input field focus', () => {
        const team1 = teamAndChannels[0].team;

        // # Visit town square channel by teamUser
        cy.visit(`/${team1.name}/channels/off-topic`);

        // # Post message in other channels by otherUser
        cy.postMessageAs({
            sender: otherUser,
            message: `Message on the ${teamAndChannels[0].channels[0].display_name}`,
            channelId: teamAndChannels[0].channels[0].id,
        }).then(() => {
            cy.postMessageAs({
                sender: otherUser,
                message: `Message on the ${teamAndChannels[0].channels[1].display_name}`,
                channelId: teamAndChannels[0].channels[1].id,
            }).then(() => {
                cy.postMessageAs({
                    sender: otherUser,
                    message: `Message on the ${teamAndChannels[0].channels[2].display_name}`,
                    channelId: teamAndChannels[0].channels[2].id,
                }).then(() => {
                    // # Press keyboard shortcut for channel switcher
                    cy.uiGetPostTextBox().cmdOrCtrlShortcut('k');

                    // * Verify channel switcher shows up
                    cy.get('.a11y__modal.channel-switcher').should('exist').and('be.visible').as('channelSwitcherDialog');

                    // * Verify the focus is on switchers input field
                    cy.focused().should('have.id', 'quickSwitchInput');

                    // * Verify all unread channels names are showing up in the dialogs list
                    cy.get('@channelSwitcherDialog').within(() => {
                        // * Verify all unread channels names are showing up in the dialogs list
                        teamAndChannels[0].channels.forEach((channel) => {
                            cy.findByText(channel.display_name).should('be.visible');
                        });
                    });
                });
            });
        });
    });
});
