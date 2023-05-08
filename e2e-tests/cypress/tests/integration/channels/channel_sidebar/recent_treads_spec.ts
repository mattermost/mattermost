// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_sidebar

describe('Sidebar category menu', () => {
    let testUser;
    let testOtherUser;
    let testChannel;
    let testChannelUrl;

    before(() => {
        cy.shouldHaveFeatureFlag('RecentChannelThreads', true);

        // # Setting up for CRT
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Login as admin and setup the env
        cy.apiInitSetup().then(({channel, channelUrl, team, user}) => {
            testUser = user;
            testChannel = channel;
            testChannelUrl = channelUrl;

            // # Create another user
            cy.apiCreateUser().then(({user}) => {
                testOtherUser = user;
                cy.apiAddUserToTeam(team.id, user.id);
                cy.apiAddUserToChannel(testChannel.id, testOtherUser.id);
            });

            // # Login as test user
            cy.apiLogin(testUser);

            // # Visit channel
            cy.visit(testChannelUrl);
        });
    });

    it('does not include following threads when CRT is disabled', () => {
    // # Disable CRT
        cy.apiSaveCRTPreference(testUser.id, 'off');

        const message = 'Thread created by current user';

        // # Create a thread
        cy.postMessageAs({
            sender: testUser,
            message,
            channelId: testChannel.id,
        }).then((post) => {
            cy.postMessageAs({
                sender: testUser,
                message: 'Reply by current user',
                channelId: testChannel.id,
                rootId: post.id,
            });
        });

        // # Open channel threads' sidebar
        cy.get('#channelThreads').should('be.visible').click();

        // * Verify that the following tab is not visible
        cy.get('#rhsContainer .tab-buttons').should('not.contain.text', 'Following');
    });

    it('includes a thread created by current user in "All", "Following", and "Created by me" tabs', () => {
        cy.apiSaveCRTPreference(testUser.id, 'on');

        const message = 'Thread created by current user';

        // # Create a thread by current user (created & following)
        cy.postMessageAs({
            sender: testUser,
            message,
            channelId: testChannel.id,
        }).then((post) => {
            cy.postMessageAs({
                sender: testUser,
                message: 'Reply by current user',
                channelId: testChannel.id,
                rootId: post.id,
            });
        });

        // # Open channel threads' sidebar
        cy.get('#channelThreads').should('be.visible').click();

        // # Go to the 'All' tab
        goToTabByName('All');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);

        // # Go to the 'Following' tab
        goToTabByName('Following');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);

        // # Go to the 'Created by me' tab
        goToTabByName('Created by me');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);
    });

    it('includes a thread created by other user only in All tab', () => {
        cy.apiSaveCRTPreference(testUser.id, 'on');

        const message = 'Thread created by other user';

        // # Create a thread by other user (not created & not following)
        cy.postMessageAs({
            sender: testOtherUser,
            message,
            channelId: testChannel.id,
        }).then((post) => {
            cy.postMessageAs({
                sender: testOtherUser,
                message: 'Reply by other user',
                channelId: testChannel.id,
                rootId: post.id,
            });
        });

        // # Open channel threads' sidebar
        cy.get('#channelThreads').should('be.visible').click();

        // # Go to the 'All' tab
        goToTabByName('All');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);

        // # Go to the 'Following' tab
        goToTabByName('Following');

        // * Verify that the thread is not visible
        cy.get('.channel-threads .ThreadItem').should('not.exist');

        // # Go to the 'Created by me' tab
        goToTabByName('Created by me');

        // * Verify that the thread is not visible
        cy.get('.channel-threads .ThreadItem').should('not.exist');
    });

    it('includes a thread created by other user and replied by current user in All and Following tabs', () => {
        cy.apiSaveCRTPreference(testUser.id, 'on');

        const message = 'Thread created by other user';

        // # Create a thread by other user (not created & following)
        cy.postMessageAs({
            sender: testOtherUser,
            message,
            channelId: testChannel.id,
        }).then((post) => {
            cy.postMessageAs({
                sender: testUser,
                message: 'Reply by current user',
                channelId: testChannel.id,
                rootId: post.id,
            });
        });

        // # Open channel threads' sidebar
        cy.get('#channelThreads').should('be.visible').click();

        // # Go to the 'All' tab
        goToTabByName('All');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);

        // # Go to the 'Following' tab
        goToTabByName('Following');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);

        // # Go to the 'Created by me' tab
        goToTabByName('Created by me');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').should('not.exist');
    });

    it('updates the following thread list instantly when a user follows a thread', () => {
        cy.apiSaveCRTPreference(testUser.id, 'on');

        const message = 'Thread created by other user';

        // # Create a thread by other user (not created & not following)
        cy.postMessageAs({
            sender: testOtherUser,
            message,
            channelId: testChannel.id,
        }).then((post) => {
            cy.postMessageAs({
                sender: testOtherUser,
                message: 'Reply by other user',
                channelId: testChannel.id,
                rootId: post.id,
            });
        });

        // # Follow the thread by current user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.FollowButton').click();
        });

        // # Open channel threads' sidebar
        cy.get('#channelThreads').should('be.visible').click();

        // # Go to the 'Following' tab
        goToTabByName('Following');

        // * Verify that the thread is visible
        cy.get('.channel-threads .ThreadItem').eq(0).should('contain.text', message);

        // # Unfollow the thread by current user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.FollowButton').click();
        });

        // * Verify that the thread is not visible
        cy.get('.channel-threads .ThreadItem').should('not.exist');
    });
});

/**
 * Navigate to the tab in the channel threads' sidebar by the tab name.
 * @param name
 */
function goToTabByName(name: string): void {
    const tabNames = ['all', 'following', 'created by me'];
    const index = tabNames.indexOf(name.toLowerCase());

    if (index === -1) {
        throw new Error(`Invalid tab name: ${name}`);
    }

    goToTabByIndex(index);
}

/**
 * Navigate to the tab in the channel threads' sidebar by the tab index.
 * @param index
 */
function goToTabByIndex(index: number): void {
    cy.get('#rhsContainer .tab-buttons .tab-button-wrapper').eq(index).click();
}
