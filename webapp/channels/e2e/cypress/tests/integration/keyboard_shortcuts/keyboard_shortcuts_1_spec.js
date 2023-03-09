// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @keyboard_shortcuts

import * as messages from '../../fixtures/messages';
import * as TIMEOUTS from '../../fixtures/timeouts';

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

    beforeEach(() => {
        // # Login as admin and visit town-square
        cy.apiAdminLogin();
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1227 - CTRL/CMD+K - Join public channel', () => {
        // # Type CTRL/CMD+K
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        cy.apiCreateUser({prefix: 'temp-'}).then(({user: tempUser}) => {
            // # Add user to team but not to test channel
            cy.apiAddUserToTeam(testTeam.id, tempUser.id);

            // # In the "Switch Channels" modal type the first chars of the test channel name
            cy.findByRole('textbox', {name: 'quick switch input'}).should('be.focused').type(testChannel.name.substring(0, 3)).wait(TIMEOUTS.HALF_SEC);

            // # Verify that the list of users and channels suggestions is present
            cy.get('#suggestionList').should('be.visible').within(() => {
                // * The channel the current user is not a member of should be there in the search list; click it
                cy.findByTestId(testChannel.name).scrollIntoView().should('exist').click().wait(TIMEOUTS.HALF_SEC);
            });

            // # Verify that we are in the test channel
            cy.get('#channelIntro').contains('.channel-intro__title', `Beginning of ${testChannel.display_name}`).should('be.visible');

            // # Verify that the right channel is displayed in LHS
            cy.uiGetLhsSection('CHANNELS').findByText(testChannel.display_name).should('be.visible');

            // # Verify that the current user(sysadmin) created the channel
            cy.get('#channelIntro').contains('.channel-intro__content', `This is the start of the ${testChannel.display_name} channel, created by sysadmin`).should('be.visible');
        });
    });

    it('MM-T1231 - ALT+SHIFT+UP', () => {
        cy.apiLogout();
        cy.apiLogin(testUser);

        cy.apiCreateTeam('team1', 'Team1').then(({team}) => {
            const privateChannels = [];
            const publicChannels = [];
            const dmChannels = [];

            // # Create two public channels
            for (let index = 0; index < 2; index++) {
                const otherUserId = otherUser.id;
                cy.apiCreateChannel(team.id, `a-public-${index}`, `A Public ${index}`).then(({channel}) => {
                    publicChannels.push(channel);
                    cy.apiAddUserToTeam(team.id, otherUserId).then(() => {
                        cy.apiAddUserToChannel(channel.id, otherUserId);
                    });
                });
            }

            // # Create two private channels
            for (let index = 0; index < 2; index++) {
                const otherUserId = otherUser.id;
                cy.apiCreateChannel(team.id, `b-private-${index}`, `B Private ${index}`, 'P').then(({channel}) => {
                    privateChannels.push(channel);
                    cy.apiAddUserToChannel(channel.id, otherUserId);
                });
            }

            // # Set up DM channel
            cy.apiCreateDirectChannel([testUser.id, otherUser.id]).wait(TIMEOUTS.ONE_SEC).then(({channel}) => {
                dmChannels.push(channel);
                cy.visit(`/${team.name}/channels/${testUser.id}__${otherUser.id}`);
                cy.uiGetPostTextBox().clear().type(`message from ${testUser.username}`).type('{enter}');
            });

            // # Add posts by second user to the newly created channels in the first team
            cy.apiLogout();
            cy.apiLogin(otherUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                cy.get('#sidebarItem_' + publicChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to public channel').type('{enter}');

                cy.get('#sidebarItem_' + privateChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to private channel').type('{enter}');

                cy.get('#sidebarItem_' + dmChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type(`direct message from ${otherUser.username}`).type('{enter}');
            });

            cy.apiLogout();
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                // # Verify that the channels are unread
                cy.get(`#sidebarItem_${publicChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${privateChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${dmChannels[0].name}`).should('have.class', 'unread-title');

                // # Navigate to the bottom of the list of channels
                cy.get('#sidebarItem_' + dmChannels[0].name).scrollIntoView().click();
                cy.get('.active').find('#sidebarItem_' + dmChannels[0].name).should('exist');

                // # Press alt + shift + up
                cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + privateChannels[0].name).should('exist');
                cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + publicChannels[0].name).should('exist');

                // # No navigation - stay in place
                cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + publicChannels[0].name).should('exist');
            });

            // # Handle favorite channels
            const favPrivateChannels = [];
            const favPublicChannels = [];
            const favDMChannels = [];

            // # Set up public favorite channel
            cy.apiCreateChannel(team.id, 'public', 'public').then(({channel}) => {
                favPublicChannels.push(channel);
                cy.apiAddUserToChannel(channel.id, otherUser.id);
                markAsFavorite(channel.name);
            });

            // # Set up private favorite channel
            cy.apiCreateChannel(team.id, 'private', 'private', 'P').then(({channel}) => {
                favPrivateChannels.push(channel);
                cy.apiAddUserToChannel(channel.id, otherUser.id);
                markAsFavorite(channel.name);
            });

            // # Set up DM favorite channel
            cy.apiCreateDirectChannel([testUser.id, otherUser.id]).wait(TIMEOUTS.ONE_SEC).then(({channel}) => {
                favDMChannels.push(channel);
                cy.visit(`/${team.name}/channels/${testUser.id}__${otherUser.id}`);
                cy.uiGetPostTextBox().clear().type(`message from ${testUser.username}`).type('{enter}');
                markAsFavorite(channel.name);
            });

            // # Add posts by second user to the newly created channels in the first team
            cy.apiLogout();
            cy.apiLogin(otherUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                cy.get('#sidebarItem_' + favPublicChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to public channel').type('{enter}');

                cy.get('#sidebarItem_' + favPrivateChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to private channel').type('{enter}');

                cy.get('#sidebarItem_' + favDMChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type(`direct message from ${otherUser.username}`).type('{enter}');
            });

            cy.apiLogout();
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                // # Verify that the channels are unread - in the Favorites tab the unread channels are ordered alphabetically
                cy.get(`#sidebarItem_${favDMChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${favPrivateChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${favPublicChannels[0].name}`).should('have.class', 'unread-title');

                // # Navigate to the middle of the list of unread favorite channels
                cy.get('#sidebarItem_' + favPrivateChannels[0].name).scrollIntoView().click();
                cy.get('.active').find('#sidebarItem_' + favPrivateChannels[0].name).should('exist');

                // # Press alt + shift + up
                cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + favDMChannels[0].name).should('exist');
                cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + favPublicChannels[0].name).should('exist');

                // # No navigation - stay in place
                cy.get('body').type('{alt}{shift}', {release: false}).type('{uparrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + favPublicChannels[0].name).should('exist');
            });
        });
    });

    it('MM-T1232 - ALT+SHIFT+DOWN', () => {
        cy.apiLogout();
        cy.apiLogin(testUser);

        cy.apiCreateTeam('team2', 'Team2').then(({team}) => {
            const privateChannels = [];
            const publicChannels = [];
            const dmChannels = [];

            // # Create two public channels
            for (let index = 0; index < 2; index++) {
                const otherUserId = otherUser.id;
                cy.apiCreateChannel(team.id, `a-public-${index}`, `A Public ${index}`).then(({channel}) => {
                    publicChannels.push(channel);
                    cy.apiAddUserToTeam(team.id, otherUserId).then(() => {
                        cy.apiAddUserToChannel(channel.id, otherUserId);
                    });
                });
            }

            // # Create two private channels
            for (let index = 0; index < 2; index++) {
                const otherUserId = otherUser.id;
                cy.apiCreateChannel(team.id, `b-private-${index}`, `B Private ${index}`).then(({channel}) => {
                    privateChannels.push(channel);
                    cy.apiAddUserToChannel(channel.id, otherUserId);
                });
            }

            // # Set up DM channel
            cy.apiCreateDirectChannel([testUser.id, otherUser.id]).wait(TIMEOUTS.ONE_SEC).then(({channel}) => {
                dmChannels.push(channel);
                cy.visit(`/${team.name}/channels/${testUser.id}__${otherUser.id}`);
                cy.uiGetPostTextBox().clear().type(`message from ${testUser.username}`).type('{enter}');
            });

            // # Add posts by second user to the newly created channels in the first team
            cy.apiLogout();
            cy.apiLogin(otherUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                cy.get('#sidebarItem_' + publicChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to public channel').type('{enter}');

                cy.get('#sidebarItem_' + privateChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to private channel').type('{enter}');

                cy.get('#sidebarItem_' + dmChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type(`direct message from ${otherUser.username}`).type('{enter}');
            });

            cy.apiLogout();
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                // # Verify that the channels are unread
                cy.get(`#sidebarItem_${publicChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${privateChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${dmChannels[0].name}`).should('have.class', 'unread-title');

                // # Navigate to the top of the list of channels
                cy.get('#sidebarItem_' + publicChannels[0].name).scrollIntoView().click();
                cy.get('.active').find('#sidebarItem_' + publicChannels[0].name).should('exist');

                // # Press alt + shift + down
                cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + privateChannels[0].name).should('exist');
                cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + dmChannels[0].name).should('exist');

                // # No navigation - stay in place
                cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + dmChannels[0].name).should('exist');
            });

            // # Handle favorite channels
            const favPrivateChannels = [];
            const favPublicChannels = [];
            const favDMChannels = [];

            // # Set up public favorite channel
            cy.apiCreateChannel(team.id, 'public', 'public').then(({channel}) => {
                favPublicChannels.push(channel);
                cy.apiAddUserToChannel(channel.id, otherUser.id);
                markAsFavorite(channel.name);
            });

            // # Set up private favorite channel
            cy.apiCreateChannel(team.id, 'private', 'private', 'P').then(({channel}) => {
                favPrivateChannels.push(channel);
                cy.apiAddUserToChannel(channel.id, otherUser.id);
                markAsFavorite(channel.name);
            });

            // # Set up DM favorite channel
            cy.apiCreateDirectChannel([testUser.id, otherUser.id]).wait(TIMEOUTS.ONE_SEC).then(({channel}) => {
                favDMChannels.push(channel);
                cy.visit(`/${team.name}/channels/${testUser.id}__${otherUser.id}`);
                cy.uiGetPostTextBox().clear().type(`message from ${testUser.username}`).type('{enter}');
                markAsFavorite(channel.name);
            });

            // # Add posts by second user to the newly created channels in the first team
            cy.apiLogout();
            cy.apiLogin(otherUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                cy.get('#sidebarItem_' + favPublicChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to public channel').type('{enter}');

                cy.get('#sidebarItem_' + favPrivateChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type('message to private channel').type('{enter}');

                cy.get('#sidebarItem_' + favDMChannels[0].name).scrollIntoView().click();
                cy.uiGetPostTextBox().clear().type(`direct message from ${otherUser.username}`).type('{enter}');
            });

            cy.apiLogout();
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/${team.name}/channels/off-topic`);

                // # Verify that the channels are unread - in the Favorites tab the unread channels are ordered alphabetically
                cy.get(`#sidebarItem_${favDMChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${favPrivateChannels[0].name}`).should('have.class', 'unread-title');
                cy.get(`#sidebarItem_${favPublicChannels[0].name}`).should('have.class', 'unread-title');

                // # Navigate to the middle of the list of unread favorite channels
                cy.get('#sidebarItem_' + favPrivateChannels[0].name).scrollIntoView().click();
                cy.get('.active').find('#sidebarItem_' + favPrivateChannels[0].name).should('exist');

                // # Press alt + shift + down
                cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + favPublicChannels[0].name).should('exist');
                cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + favDMChannels[0].name).should('exist');

                // # No navigation - stay in place
                cy.get('body').type('{alt}{shift}', {release: false}).type('{downarrow}').type('{alt}{shift}', {release: true});
                cy.get('.active').find('#sidebarItem_' + favDMChannels[0].name).should('exist');
            });
        });
    });

    it('MM-T1240 - CTRL/CMD+K: Open and close', () => {
        // # Type CTRL/CMD+K to open 'Switch Channels' modal
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K').then(() => {
            // * Channel switcher hint should be visible and focused on
            cy.get('#quickSwitchHint').should('be.visible');
            cy.findByRole('textbox', {name: 'quick switch input'}).should('be.focused');
        });

        // # Type CTRL/CMD+K to close 'Switch Channels' modal
        cy.get('body').cmdOrCtrlShortcut('K');
        cy.get('#quickSwitchHint').should('not.exist');
    });

    it('MM-T1248 - CTRL/CMD+SHIFT+L - Set focus to center channel message box', () => {
        // # Open search box to change focus
        cy.get('#searchBox').click().should('be.focused').then(() => {
            // # Type CTRL/CMD+SHIFT+L
            cy.get('body').cmdOrCtrlShortcut('{shift}L');
            cy.uiGetPostTextBox().should('be.focused');
        });

        // # Post a message and open RHS
        const message = `hello${Date.now()}`;
        cy.postMessage(message);
        cy.getLastPostId().then((postId) => {
            // # Mouseover the post and click post comment icon.
            cy.clickPostCommentIcon(postId);
            cy.uiGetReplyTextBox().focus().should('be.focused');
        }).then(() => {
            // # Type CTRL/CMD+SHIFT+L
            cy.get('body').cmdOrCtrlShortcut('{shift}L');
            cy.uiGetPostTextBox().should('be.focused');
        });
    });

    it('MM-T1252 - CTRL/CMD+SHIFT+A', () => {
        // # Type CTRL/CMD+SHIFT+A to open 'Profile' modal
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{shift}A');
        cy.uiGetSettingsModal().should('be.visible');

        // # Type CTRL/CMD+SHIFT+A to close 'Profile' modal
        cy.get('body').cmdOrCtrlShortcut('{shift}A');
        cy.uiGetSettingsModal().should('not.exist');
    });

    it('MM-T1278 - CTRL/CMD+SHIFT+K', () => {
        // # Type CTRL/CMD+SHIFT+K to open 'Direct Messages' modal
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{shift}K');
        cy.get('#moreDmModal').should('be.visible').contains('Direct Messages');

        // # Type CTRL/CMD+SHIFT+K to close 'Direct Messages' modal
        cy.get('body').cmdOrCtrlShortcut('{shift}K');
        cy.get('#moreDmModal').should('not.exist');
    });

    it('MM-T4452 - CTRL/CMD+SHIFT+. Expand or collapse RHS when RHS is already open', () => {
        // # Post a message in center
        cy.postMessage(messages.TINY);

        // # Mouseover the post and click post comment icon.
        cy.clickPostCommentIcon();

        // # Type CTRL/CMD+SHIFT+. to expand 'RHS'
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{shift}.');

        // * Verify RHS is now expanded
        cy.uiGetRHS().isExpanded();

        // # Type CTRL/CMD+SHIFT+. to collapse 'RHS'
        cy.get('body').cmdOrCtrlShortcut('{shift}.');

        // * Verify RHS is now in collapsed state
        cy.get('#sidebar-right').should('be.visible').and('not.have.class', 'sidebar--right--expanded');
    });

    it('MM-T4452 - CTRL/CMD+SHIFT+. Expand or collapse RHS when RHS is in closed state', () => {
        // # Type CTRL/CMD+SHIFT+. to open 'RHS'
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{shift}.');

        // * Verify RHS is now open and is in collapsed state
        cy.get('#sidebar-right').should('be.visible').and('not.have.class', 'sidebar--right--expanded');

        // # Type CTRL/CMD+SHIFT+. to expand 'RHS'
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{shift}.');

        // * Verify RHS is now fully expanded
        cy.uiGetRHS().isExpanded();

        // # Type CTRL/CMD+SHIFT+. to collapse 'RHS'
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{shift}.');

        // * Verify RHS is now in collapsed state
        cy.get('#sidebar-right').should('be.visible').and('not.have.class', 'sidebar--right--expanded');
    });

    function markAsFavorite(channelName) {
        // # Visit the channel
        cy.get(`#sidebarItem_${channelName}`).scrollIntoView().click();

        cy.get('#postListContent').should('be.visible');

        // # Remove from Favorites if already set
        cy.get('#channelHeaderInfo').then((el) => {
            if (el.find('#toggleFavorite.active').length) {
                cy.get('#toggleFavorite').click();
            }
        });

        // # Mark it as Favorite
        cy.get('#toggleFavorite').click();
    }
});
