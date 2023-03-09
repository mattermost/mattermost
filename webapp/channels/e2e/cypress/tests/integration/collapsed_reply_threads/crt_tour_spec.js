// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @collapsed_reply_threads

describe('Collapsed Reply Threads', () => {
    let testTeam;
    let otherUser;
    let testChannel;
    let rootPost;

    beforeEach(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Log in as user that hasn't had CRT enabled before
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true, userPrefix: 'tipbutton'}).then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);

                    // # Post a message as other user
                    cy.postMessageAs({sender: otherUser, message: 'Root post', channelId: testChannel.id}).then((post) => {
                        rootPost = post;
                    });
                });
            });

            // # Visit the channel
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T4684 CRT - CRT tour - full', () => {
        // # Go to Settings>Display>Display Settings>Collapsed Reply Threads (Beta), select ON and Save
        // # Dismiss "You're accessing an early beta of CRT" modal
        cy.uiChangeCRTDisplaySetting('ON');

        // # Open any post on RHS
        cy.uiGetNthPost(1).click();

        // * Verify green dot on Thread title on the thread header
        cy.get('.sidebar--right__header').find('#tipButton').should('be.visible');

        // * Verify 1st tutorial tip points is present
        cy.get('[data-testid="current_tutorial_tip"]').findByText('Viewing a thread in the sidebar').should('be.visible');

        // * Verify "Got it" button is present
        cy.findByText('Got it').should('be.visible');

        // # Click on "Got it" button
        cy.findByText('Got it').click();

        // * Verify tutorial tip is dismissed
        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');

        // * Verify green dot is is no longer present
        cy.get('.sidebar--right__header').find('#tipButton').should('not.exist');

        // # Follow an existing thread or receive replies to root post you started
        cy.get('#rhsContainer').find('.FollowButton').click();
        cy.postMessageAs({sender: otherUser, message: 'other reply!', channelId: testChannel.id, rootId: rootPost.id});

        // * Verify green pulsing dot on global threads
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('be.visible');

        // # Click on global Threads sidebar item
        cy.uiGetSidebarItem('threads').click();

        // * Verify "A new way to view and follow thread" modal is present
        cy.get('#collapsed_reply_threads_modal').should('be.visible').as('crtModal');
        cy.get('@crtModal').findByText('A new way to view and follow threads').should('be.visible');

        // * Verify "Take the Tour" button is present
        cy.get('@crtModal').findByText('Take the Tour').should('be.visible');

        // * Verify "Skip Tour" button is present
        cy.get('@crtModal').findByText('Skip Tour').should('be.visible');

        // # Click on Take the tour button
        cy.get('@crtModal').findByText('Take the Tour').click();

        // * Verify "Welcome to the Threads view!" tour tip
        cy.get('[data-testid="current_tutorial_tip"]').findByText('Welcome to the Threads view!').should('be.visible');

        // * Verify Next button is present
        cy.findByText('Next').should('be.visible');

        // * Verify 3 radio buttons on the bottom, with the far left button active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot active');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot');

        // # Click on the Next button
        cy.findByText('Next').click();

        // * Verify green dot on first thread
        cy.get('[data-testid="threads_list"]').find('#tipButton').should('be.visible');

        // * Verify "Threads List" tutorial tip
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').within(() => {
            cy.findByText('Threads List').should('be.visible');
        });

        // * Verify "Previous" button is present
        cy.findByText('Previous').should('be.visible');

        // * Verify "Next" button is present
        cy.findByText('Next').should('be.visible');

        // * Verify middle radio button is active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot active');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot');

        // # Click on Next
        cy.findByText('Next').click();

        // * Verify green dot on Unreads tab
        cy.get('#threads-list-unread-button').find('#tipButton').should('be.visible');

        // * Verify "Unread threads" tutorial tip
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').findByText('Unread threads').should('be.visible');

        // * Verify "Previous" button is present
        cy.findByText('Previous').should('be.visible');

        // * Verify "Done" button is present
        cy.findByText('Done').should('be.visible');

        // * Verify far right radio button is active
        // * Verify 3 radio buttons on the bottom, with the far left button active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot active');

        // # Click on "Done" button
        cy.findByText('Done').click();

        // * Verify tour is dismissed
        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');
        cy.get('[data-testid="threads_list"]').find('#tipButton').should('not.exist');
        cy.get('#threads-list-unread-button').find('#tipButton').should('not.exist');
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('not.exist');
    });

    it('MM-T4694 CRT - Skip the tour', () => {
        // # Go to Settings>Display>Display Settings>Collapsed Reply Threads (Beta), select ON and Save
        // # Dismiss "You're accessing an early beta of CRT" modal
        cy.uiChangeCRTDisplaySetting('ON');

        // # Open any post on RHS
        cy.uiGetNthPost(1).click();

        // * Verify green dot on Thread title on the thread header
        cy.get('.sidebar--right__header').find('#tipButton').should('be.visible');

        // * Verify 1st tutorial tip points is present
        cy.get('[data-testid="current_tutorial_tip"]').findByText('Viewing a thread in the sidebar').should('be.visible');

        // * Verify "Got it" button is present
        cy.findByText('Got it').should('be.visible');

        // # Click on "x" button to dismiss the tour point
        cy.get('[data-testid="close_tutorial_tip"]').click();

        // * Verify tutorial tip is dismissed
        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');

        // * Verify green dot is is no longer present
        cy.get('.sidebar--right__header').find('#tipButton').should('not.exist');

        // # Follow an existing thread or receive replies to root post you started
        cy.get('#rhsContainer').find('.FollowButton').click();
        cy.postMessageAs({sender: otherUser, message: 'other reply!', channelId: testChannel.id, rootId: rootPost.id});

        // * Verify green pulsing dot on global threads
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('be.visible');

        // # Click on global Threads sidebar item
        cy.uiGetSidebarItem('threads').click();

        // * Verify "A new way to view and follow thread" modal is present
        cy.get('#collapsed_reply_threads_modal').should('be.visible').within(() => {
            cy.findByText('A new way to view and follow threads').should('be.visible');

            // * Verify "Take the Tour" button is present
            cy.findByText('Take the Tour').should('be.visible');

            // * Verify "Skip Tour" button is present
            cy.findByText('Skip Tour').should('be.visible');

            // # Click on "x" button to dismiss the tour point
            cy.get('.close').click();
        });

        // * Verify tutorial modal is dismissed
        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');

        // * Verify green dot is still present
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('be.visible');

        // # Click on global Threads sidebar item
        cy.uiGetSidebarItem('threads').click();

        // # Click on "Skip tour" button
        cy.get('#collapsed_reply_threads_modal').should('be.visible').findByText('Skip Tour').click();

        // * Verify modal is dismissed and tour is no longer available
        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');
        cy.get('[data-testid="threads_list"]').find('#tipButton').should('not.exist');
        cy.get('#threads-list-unread-button').find('#tipButton').should('not.exist');

        // * Verify no pulsing green dot on global threads item
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('not.exist');
    });

    it('MM-T4695 CRT - cancel any tour point by using x', () => {
        // # Go to Settings>Display>Display Settings>Collapsed Reply Threads (Beta), select ON and Save
        // # Dismiss "You're accessing an early beta of CRT" modal
        cy.uiChangeCRTDisplaySetting('ON');

        // # Follow an existing thread or receive replies to root post you started
        cy.postMessageAs({sender: otherUser, message: 'other reply!', channelId: testChannel.id, rootId: rootPost.id});
        cy.get(`#post_${rootPost.id}`).find('.FollowButton').click();

        // * Verify green pulsing dot on global threads
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('be.visible');

        // # Click on global Threads sidebar item
        cy.uiGetSidebarItem('threads').click();

        // * Verify "A new way to view and follow thread" modal is present
        cy.get('#collapsed_reply_threads_modal').should('be.visible').within(() => {
            cy.findByText('A new way to view and follow threads').should('be.visible');

            // * Verify "Take the Tour" button is present
            cy.findByText('Take the Tour').should('be.visible');

            // * Verify "Skip Tour" button is present
            cy.findByText('Skip Tour').should('be.visible');

            // # Click on Take the tour button
            cy.findByText('Take the Tour').click();
        });

        // * Verify "Welcome to the Threads view!" tutorial tip
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').within(() => {
            cy.findByText('Welcome to the Threads view!').should('be.visible');
        });

        // * Verify Next button is present
        cy.findByText('Next').should('be.visible');

        // * Verify 3 radio buttons on the bottom, with the far left button active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot active');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot');

        // # Click on the `x` to dismiss the tip
        cy.get('[data-testid="close_tutorial_tip"]').click();

        // * Verify green dot on Threads sidebar item
        cy.get('#SidebarContainer').find('#tipButton').should('be.visible').click();

        cy.findByText('Next').click();

        // # Click on the `x` to dismiss the tip
        cy.get('[data-testid="close_tutorial_tip"]').click();

        // * Verify green pulsing dot on the first, top,  thread
        cy.get('[data-testid="threads_list"]').within(() => {
            cy.get('#tipButton').should('be.visible');

            // # Click on the green dot
            cy.get('#tipButton').click();
        });

        // * Verify green dot on first thread
        cy.get('[data-testid="threads_list"]').find('#tipButton').should('be.visible');

        // * Verify "Threads List" tutorial tip
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').within(() => {
            cy.findByText('Threads List').should('be.visible');
        });

        // * Verify "Previous" button is present
        cy.findByText('Previous').should('be.visible');

        // * Verify "Next" button is present
        cy.findByText('Next').should('be.visible');

        // * Verify middle radio button is active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot active');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot');

        // # Click on the Previous button
        cy.findByText('Previous').click();

        // * Verify previous tutorial tip opens
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').within(() => {
            cy.findByText('Welcome to the Threads view!').should('be.visible');
        });

        // * Verify far left radio button is active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot active');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot');

        // # Click Next and ...
        cy.findByText('Next').click();

        // # ... then x to dismiss the Threads List tip
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').within(() => {
            cy.findByText('Threads List').should('be.visible');
            cy.get('[data-testid="close_tutorial_tip"]').click();
        });

        // * Verify tip is dismissed
        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');

        cy.get('[data-testid="threads_list"]').find('#tipButton').should('be.visible').click();

        // # Click Next and ...
        cy.findByText('Next').click();

        cy.get('[data-testid="close_tutorial_tip"]').click();

        // * Verify green dot on Unreads tab
        cy.get('#threads-list-unread-button').within(() => {
            cy.get('#tipButton').should('be.visible');
        });

        // # Click on the green dot on Unreads tab
        cy.get('#tipButton').click();

        // * Verify "Unread threads" tutorial tip
        cy.get('[data-testid="current_tutorial_tip"]').should('be.visible').within(() => {
            cy.findByText('Unread threads').should('be.visible');
        });

        // * Verify "Previous" button is present
        cy.findByText('Previous').should('be.visible');

        // * Verify "Finish tour" button is present
        cy.findByText('Done').should('be.visible');

        // * Verify far right radio button is active
        cy.get('.tour-tip__dot-ctr').should('be.visible').children().as('crtTourTip');
        cy.get('@crtTourTip').eq(0).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(1).find('a').should('have.class', 'tour-tip__dot');
        cy.get('@crtTourTip').eq(2).find('a').should('have.class', 'tour-tip__dot active');

        // # Click on `x` to dismiss tutorial tip
        cy.get('[data-testid="close_tutorial_tip"]').click();

        // * Verify tour is dismissed
        cy.get('#threads-list-unread-button').find('#tipButton').should('be.visible').click();
        cy.findByText('Done').should('be.visible').click();
        cy.get('#threads-list-unread-button').find('#tipButton').should('not.exist');

        cy.get('[data-testid="current_tutorial_tip"]').should('not.exist');
        cy.get('[data-testid="threads_list"]').find('#tipButton').should('not.exist');
        cy.get('#sidebar-threads-button').find('[data-testid="pulsating_dot"]').should('not.exist');
    });
});
