// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings @smoke

import {getRandomId} from '../../../utils';

describe('Channel Settings', () => {
    let testTeam: Cypress.Team;
    let firstUser: Cypress.UserProfile;
    let addedUsersChannel: Cypress.Channel;
    let username: string;
    let groupId: string;
    const usernames: string[] = [];

    const users: Cypress.UserProfile[] = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            firstUser = user;
            const teamId = testTeam.id;

            // # Add 10 users
            for (let i = 0; i < 10; i++) {
                cy.apiCreateUser().then(({user: newUser}) => {
                    users.push(newUser);
                    cy.apiAddUserToTeam(teamId, newUser.id);
                });
            }
            cy.apiCreateChannel(teamId, 'channel-test', 'Channel').then(({channel}) => {
                addedUsersChannel = channel;
            });

            // # Change permission so that regular users can't add team members
            cy.apiGetRolesByNames(['team_user']).then((result: any) => {
                if (result.roles) {
                    const role = result.roles[0];
                    const permissions = role.permissions.filter((permission) => {
                        return !(['add_user_to_team'].includes(permission));
                    });

                    if (permissions.length !== role.permissions) {
                        cy.apiPatchRole(role.id, {permissions});
                    }
                }
            });

            cy.apiLogin(firstUser);
        }).then(() => {
            groupId = getRandomId();
            cy.apiCreateCustomUserGroup(`group${groupId}`, `group${groupId}`, [users[0].id, users[1].id]);
        });
    });

    it('MM-T859_1 Single User: Usernames are links, open profile popovers', () => {
        // # Create and visit new channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Add users to channel
            addNumberOfUsersToChannel(1, false);

            cy.getLastPostId().then((id) => {
                // * The system message should contain 'added to the channel by you'
                cy.get(`#postMessageText_${id}`).should('contain', 'added to the channel by you');

                // # Verify username link
                verifyMentionedUserAndProfilePopover(id);
            });
        });
    });

    it('MM-T859_2 Combined Users: Usernames are links, open profile popovers', () => {
        // # Create and visit new channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            addNumberOfUsersToChannel(3, false);

            cy.getLastPostId().then((id) => {
                cy.get(`#postMessageText_${id}`).should('contain', '2 others were added to the channel by you');

                // # Click "2 others" to expand more users
                cy.get(`#post_${id}`).find('.markdown__paragraph-inline').siblings('a').first().click().then(() => {
                    // # Verify each username link
                    verifyMentionedUserAndProfilePopover(id);
                });
            });
        });
    });

    it('MM-T856_1 Add existing users to public channel from drop-down > Add Members', () => {
        // # Visit the add users channel
        cy.visit(`/${testTeam.name}/channels/${addedUsersChannel.name}`);

        // # Open channel menu and click 'Add Members'
        cy.uiOpenChannelMenu('Add Members');
        cy.get('#addUsersToChannelModal').should('be.visible');

        // # Type into the input box to search for a user
        cy.get('#selectItems input').typeWithForce('user');

        // # First add one user in order to see them disappearing from the list
        cy.get('#multiSelectList > div').not(':contains("Already in channel")').first().then((el) => {
            const childNodes = Array.from(el[0].childNodes);
            childNodes.map((child: HTMLElement) => usernames.push(child.innerText));

            // # Get username from text for comparison
            username = usernames.toString().match(/\w+/g)[0];
            cy.get('#multiSelectList').should('contain', username);

            // # Verify status wrapper is present within the modal list
            cy.get(el as unknown as string).children().first().should('have.class', 'status-wrapper');

            // # Click to add the first user
            cy.wrap(el).click();

            // # Verify users list is not visible
            cy.get('#multiSelectList').should('not.exist');

            // # Click 'Add' button
            cy.uiGetButton('Add').click();
            cy.get('#addUsersToChannelModal').should('not.exist');
        });

        // # Verify that the last system post also contains the username
        cy.getLastPostId().then((id) => {
            cy.get(`#postMessageText_${id}`).should('contain', `${username} added to the channel by you.`);
        });

        // Add two more users
        addNumberOfUsersToChannel(2, false);

        // Verify that the system post reflects the number of added users
        cy.getLastPostId().then((id) => {
            cy.get(`#postMessageText_${id}`).should('contain', 'added to the channel by you');
        });
    });

    it('MM-T856_2 Existing users cannot be added to public channel from drop-down > Add Members', () => {
        cy.apiAdminLogin();

        // # Visit the add users channel
        cy.visit(`/${testTeam.name}/channels/${addedUsersChannel.name}`);

        // # Verify that the system message for adding users displays
        cy.getLastPostId().then((id) => {
            cy.get(`#postMessageText_${id}`).should('contain', `added to the channel by @${firstUser.username}`);
        });

        // Visit off topic where all users are added
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Open channel menu and click 'Add Members'
        cy.uiOpenChannelMenu('Add Members');
        cy.get('#addUsersToChannelModal').should('be.visible');

        // # Type into the input box to search for already added user
        cy.get('#selectItems input').typeWithForce(firstUser.username);

        // * Verify user list exist
        cy.get('#multiSelectList').should('exist').within(() => {
            cy.findByText('Already in channel').should('be.visible');
        });
        cy.get('body').type('{esc}');
    });

    it('Add group members to channel', () => {
        cy.apiLogin(firstUser);

        // # Create a new channel
        cy.apiCreateChannel(testTeam.id, 'new-channel', 'New Channel').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Open channel menu and click 'Add Members'
            cy.uiOpenChannelMenu('Add Members');

            // * Assert that modal appears
            cy.get('#addUsersToChannelModal').should('be.visible');

            // # Type 'group'+ id created in beforeAll into the input box
            cy.get('#selectItems input').typeWithForce(`group${groupId}`);

            // # Click the first row for a number of times
            // cy.get('#multiSelectList').should('be.visible').first().click();
            cy.get('#multiSelectList').should('exist').children().first().click();

            // # Click the button "Add" to add user to a channel
            cy.uiGetButton('Add').click();

            // # Wait for the modal to disappear
            cy.get('#addUsersToChannelModal').should('not.exist');

            cy.getLastPostId().then((id) => {
                // * The system message should contain 'added to the channel by you'
                cy.get(`#postMessageText_${id}`).should('contain', 'added to the channel by you');

                // # Verify username link
                verifyMentionedUserAndProfilePopover(id);
            });

            // * Check that the number of channel members is 3
            cy.get('#channelMemberCountText').
                should('be.visible').
                and('have.text', '3');
        });
    });

    it('Add group members that are not team members', () => {
        cy.apiAdminLogin();

        // # Create a new user
        cy.apiCreateUser().then(({user: newUser}) => {
            const id = getRandomId();

            // # Create a custom user group
            cy.apiCreateCustomUserGroup(`newgroup${id}`, `newgroup${id}`, [newUser.id]).then(() => {
                // # Create a new channel
                cy.apiCreateChannel(testTeam.id, 'new-group-channel', 'New Group Channel').then(({channel}) => {
                    // # Visit a channel
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                    // # Open channel menu and click 'Add Members'
                    cy.uiOpenChannelMenu('Add Members');

                    // * Assert that modal appears
                    cy.get('#addUsersToChannelModal').should('be.visible');

                    // # Type 'group' into the input box
                    cy.get('#selectItems input').typeWithForce(`newgroup${id}`);

                    // # Click the first row for a number of times
                    // cy.get('#multiSelectList').should('be.visible').first().click();
                    cy.get('#multiSelectList').should('exist').children().first().click();

                    // * Check you get a warning when adding a non team member
                    cy.findByTestId('teamWarningBanner').should('contain', '1 user was not selected because they are not a part of this team');

                    // * Check the correct username is appearing in the team invite banner
                    cy.findByTestId('teamWarningBanner').should('contain', `@${newUser.username}`);

                    // # Click the button "Add" to add user to a channel
                    cy.uiGetButton('Cancel').click();

                    // # Wait for the modal to disappear
                    cy.get('#addUsersToChannelModal').should('not.exist');
                });
            });
        });
    });

    it('Add group members and guests that are not team members', () => {
        cy.apiAdminLogin();

        // # Create a new user
        cy.apiCreateUser().then(({user: newUser}) => {
            // # Create a guest user
            cy.apiCreateGuestUser({}).then(({guest}) => {
                const id = getRandomId();

                // # Create a custom user group
                cy.apiCreateCustomUserGroup(`guestgroup${id}`, `guestgroup${id}`, [guest.id, newUser.id]).then(() => {
                    // # Create a new channel
                    cy.apiCreateChannel(testTeam.id, 'group-guest-channel', 'Channel').then(({channel}) => {
                        // # Visit a channel
                        cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                        // # Open channel menu and click 'Add Members'
                        cy.uiOpenChannelMenu('Add Members');

                        // * Assert that modal appears
                        cy.get('#addUsersToChannelModal').should('be.visible');

                        // # Type 'group' into the input box
                        cy.get('#selectItems input').typeWithForce(`guestgroup${id}`);

                        // # Click the first row for a number of times
                        // cy.get('#multiSelectList').should('be.visible').first().click();
                        cy.get('#multiSelectList').should('exist').children().first().click();

                        // * Check you get a warning when adding a non team member
                        cy.findByTestId('teamWarningBanner').should('contain', '2 users were not selected because they are not a part of this team');

                        // * Check the correct username is appearing in the invite to team portion
                        cy.findByTestId('teamWarningBanner').should('contain', `@${newUser.username}`);

                        // * Check the guest username is in the warning message and won't be added to the team
                        cy.findByTestId('teamWarningBanner').should('contain', `@${guest.username} is a guest user`);

                        // # Click the button "Add" to add user to a channel
                        cy.uiGetButton('Cancel').click();

                        // # Wait for the modal to disappear
                        cy.get('#addUsersToChannelModal').should('not.exist');
                    });
                });
            });
        });
    });

    it('User doesn\'t have permission to add user to team', () => {
        cy.apiAdminLogin();

        // # Create a new user
        cy.apiCreateUser().then(({user: newUser}) => {
            const id = getRandomId();

            // # Create a custom user group
            cy.apiCreateCustomUserGroup(`newgroup${id}`, `newgroup${id}`, [newUser.id]).then(() => {
                // # Create a new channel
                cy.apiCreateChannel(testTeam.id, 'new-group-channel', 'Channel').then(({channel}) => {
                    cy.apiLogin(firstUser);

                    // # Visit a channel
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                    // # Open channel menu and click 'Add Members'
                    cy.uiOpenChannelMenu('Add Members');

                    // * Assert that modal appears
                    cy.get('#addUsersToChannelModal').should('be.visible');

                    // # Type 'group' into the input box
                    cy.get('#selectItems input').typeWithForce(`newgroup${id}`);

                    // # Click the first row for a number of times
                    // cy.get('#multiSelectList').should('be.visible').first().click();
                    cy.get('#multiSelectList').should('exist').children().first().click();

                    // * Check you get a warning when adding a non team member
                    cy.findByTestId('teamWarningBanner').should('contain', '1 user was not selected because they are not a part of this team');

                    // * Check the correct username is appearing in the team invite banner
                    cy.findByTestId('teamWarningBanner').should('contain', `@${newUser.username}`);
                });
            });
        });
    });
});

function verifyMentionedUserAndProfilePopover(postId: string) {
    cy.get(`#post_${postId}`).find('.mention-link').each(($el) => {
        // # Get username from each mentioned link
        const userName = $el[0].innerHTML;

        // # Click each username link
        cy.wrap($el).click();

        // * Profile popover should be visible
        cy.get('div.user-profile-popover').should('be.visible');

        // * The username in the popover the same as the username link for each user
        cy.get('div.user-profile-popover').should('contain', userName);
        cy.get('button.closeButtonRelativePosition').click();

        // Click anywhere to close profile popover
        cy.get('#channelHeaderInfo').click();
    });
}

function addNumberOfUsersToChannel(num = 1, allowExisting = false) {
    // # Open channel menu and click 'Add Members'
    cy.uiOpenChannelMenu('Add Members');
    cy.get('#addUsersToChannelModal').should('be.visible');

    // * Assert that modal appears
    // # Click the first row for a number of times
    Cypress._.times(num, () => {
        cy.get('#selectItems input').typeWithForce('user');

        // cy.get('#multiSelectList').should('be.visible').first().click();
        if (allowExisting) {
            cy.get('#multiSelectList').should('exist').children().first().click();
        } else {
            cy.get('#multiSelectList').should('exist').children().not(':contains("Already in channel")').first().click();
        }
    });

    // # Click the button "Add" to add user to a channel
    cy.uiGetButton('Add').click();

    // # Wait for the modal to disappear
    cy.get('#addUsersToChannelModal').should('not.exist');
}
