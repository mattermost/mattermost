// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings @smoke

describe('Channel Settings', () => {
    let testTeam: Cypress.Team;
    let firstUser: Cypress.UserProfile;
    let addedUsersChannel: Cypress.Channel;
    let username: string;
    const usernames: string[] = [];

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            firstUser = user;

            // # Add 4 users
            for (let i = 0; i < 4; i++) {
                cy.apiCreateUser().then(({user: newUser}) => { // eslint-disable-line
                    cy.apiAddUserToTeam(testTeam.id, newUser.id);
                });
            }
            cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
                addedUsersChannel = channel;
            });

            cy.apiLogin(firstUser);
        });
    });

    it('MM-T859_1 Single User: Usernames are links, open profile popovers', () => {
        // # Create and visit new channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Add users to channel
            addNumberOfUsersToChannel(1);

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

            addNumberOfUsersToChannel(3);

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
        cy.get('#selectItems input').typeWithForce('u');

        // # First add one user in order to see them disappearing from the list
        cy.get('#multiSelectList > div').first().then((el) => {
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
        addNumberOfUsersToChannel(2);

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
});

function verifyMentionedUserAndProfilePopover(postId: string) {
    cy.get(`#post_${postId}`).find('.mention-link').each(($el) => {
        // # Get username from each mentioned link
        const userName = $el[0].innerHTML;

        // # Click each username link
        cy.wrap($el).click();

        // * Profile popover should be visible
        cy.get('#user-profile-popover').should('be.visible');

        // * The username in the popover the same as the username link for each user
        cy.get('#userPopoverUsername').should('contain', userName);

        // Click anywhere to close profile popover
        cy.get('#channelHeaderInfo').click();
    });
}

function addNumberOfUsersToChannel(num = 1) {
    // # Open channel menu and click 'Add Members'
    cy.uiOpenChannelMenu('Add Members');
    cy.get('#addUsersToChannelModal').should('be.visible');

    // * Assert that modal appears
    // # Click the first row for a number of times
    Cypress._.times(num, () => {
        cy.get('#selectItems input').typeWithForce('u');
        cy.get('#multiSelectList').should('be.visible').first().click();
    });

    // # Click the button "Add" to add user to a channel
    cy.uiGetButton('Add').click();

    // # Wait for the modal to disappear
    cy.get('#addUsersToChannelModal').should('not.exist');
}
