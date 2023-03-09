// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import timeouts from '../../fixtures/timeouts';

describe('Messaging', () => {
    let offTopicPath;
    let testTeam;
    const defaultEmojis = ['+1 emoji', 'grinning emoji', 'white check mark emoji'];

    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl, team}) => {
            testTeam = team;
            offTopicPath = offTopicUrl;
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T4261_1 One-click reactions on a post', () => {
        // # Ensure emoji picker is enabled in System console
        cy.apiAdminLogin();
        cy.visit('/admin_console/site_config/emoji');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Emoji');

        cy.findByTestId('ServiceSettings.EnableEmojiPickertrue').check();

        cy.get('#saveSetting').then((btn) => {
            if (btn.is(':enabled')) {
                btn.click();

                cy.waitUntil(() => cy.get('#saveSetting').then((el) => {
                    return el[0].innerText === 'Save';
                }));
            }
        });

        // Login with the test user to ensure the recently used emojis are defaulted
        cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
            cy.apiAddUserToTeam(testTeam.id, user1.id);
            cy.apiLogin(user1);
        });

        // # Create a post and hover over post menu and verify One click reactions are not part of the post menu on hover
        cy.visit(offTopicPath);

        // # Toggle One-click reactions option in Account Settings>Display>One-click reactions on messages to ON
        cy.uiOpenSettingsModal('Display').within(() => {
            cy.findByText('Display', {timeout: timeouts.ONE_MIN}).click();
            cy.findByText('Quick reactions on messages').click();
            cy.findByLabelText('On').click();
            cy.uiSaveAndClose();
        });

        cy.postMessage('Test post for recent reactions.');

        cy.getLastPostId().then((postId) => {
            // # Hover over the post menu
            // * Verify One click reactions are part of the post menu on hover
            // * Verify +1, grinning and white check mark are 3 default emoji shown
            validateQuickReactions(postId, 'CENTER', defaultEmojis);

            // # Open the same post in RHS and hover over the post
            cy.get(`#post_${postId}`).click();

            // * Verify only one emoji is part of the post menu, +1
            validateQuickReactions(postId, 'RHS_ROOT', defaultEmojis);

            // # Click on Expand Sidebar to expand RHS
            cy.uiExpandRHS();

            // * Verify all 3 default emoji are part of the post menu on hover
            validateQuickReactions(postId, 'RHS_ROOT', defaultEmojis);

            // # Close RHS
            cy.uiCloseRHS();

            // # React to post with new emoji e.g "wave"
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            cy.get('#emojiPickerSearch').type('wave');

            cy.clickEmojiInEmojiPicker('wave');

            let recentEmojis = ['wave emoji', '+1 emoji', 'grinning emoji'];

            // # Hover over post again
            // * Verify most recent emoji is shown slotted in the 1st place, pushing white check mark emoji out
            validateQuickReactions(postId, 'CENTER', recentEmojis);

            // Use 2 more new emoji reactions (other then default) on the same post and hover
            cy.clickPostReactionIcon(postId);
            cy.clickEmojiInEmojiPicker('blush');

            cy.clickPostReactionIcon(postId);
            cy.clickEmojiInEmojiPicker('innocent');

            recentEmojis = ['innocent emoji', 'blush emoji', 'wave emoji'];

            // # Hover over post again
            // * Verify 3 most recent emoji are shown as one click reaction options, with the last used in the 1st slot and all default emoji have been pushed out, no longer visible.
            validateQuickReactions(postId, 'CENTER', recentEmojis);
        });

        cy.postMessage('Another post for recent reactions.');

        cy.getLastPostId().then((postId) => {
            cy.clickPostReactionIcon(postId);

            // # Use :wave: reaction again few times on different posts
            cy.get('#emojiPickerSearch').type('wave');
            cy.clickEmojiInEmojiPicker('wave');

            // * Verify :wave: is sorted on the left as most frequently used
            let recentEmojis = ['wave emoji', 'innocent emoji', 'blush emoji'];
            validateQuickReactions(postId, 'CENTER', recentEmojis);

            // # Use +1 reaction again
            cy.clickPostReactionIcon(postId);

            cy.get('#emojiPickerSearch').type('+1');
            cy.findByTestId('+1,thumbsup').parent().click();

            // * Verify :wave: is still in the far left spot as the most frequently used reaction
            recentEmojis = ['wave emoji', '+1 emoji', 'innocent emoji'];
            validateQuickReactions(postId, 'CENTER', recentEmojis);
        });
    });

    it('MM-T4261_2 One-Click Reactions setting with Emoji Picker OFF', () => {
        // # Navigate to System Console>Site Configuration>Emoji>Enable Emoji Picker, set it to FALSE and save
        // # Ensure emoji picker is enabled in System console
        cy.apiAdminLogin();
        cy.visit('/admin_console/site_config/emoji');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Emoji');

        cy.findByTestId('ServiceSettings.EnableEmojiPickerfalse').check();

        cy.get('#saveSetting').then((btn) => {
            if (btn.is(':enabled')) {
                btn.click();

                cy.waitUntil(() => cy.get('#saveSetting').then((el) => {
                    return el[0].innerText === 'Save';
                }));
            }
        });

        cy.visit(offTopicPath).wait(timeouts.HALF_SEC);

        // # Open Account Settings > Display
        // * Verify One-click reactions on messages option is not available
        cy.uiOpenSettingsModal('Display').within(() => {
            cy.findByText('Display', {timeout: timeouts.ONE_MIN}).click();
            cy.findByText('Quick reactions on messages').should('not.exist');
            cy.uiClose();
        });

        // # Create a post and hover to reveal post menu
        cy.postMessage('Test post for recent reactions. (2)');

        // * Verify one click reactions are not shown on the post menu
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).trigger('mouseover', {force: true}).within(() => {
                cy.wait(timeouts.HALF_SEC).get(`#recent_reaction_${0}`).should('not.exist');
            });
        });
    });

    function validateQuickReactions(postId, location, emojis) {
        let idPrefix;
        let numReactions = 3;

        if (location === 'CENTER') {
            idPrefix = 'post';
        } else if (location === 'RHS_ROOT' || location === 'RHS_COMMENT') {
            idPrefix = 'rhsPost';
            numReactions = 1;
        } else if (location === 'RHS_EXPANDED') {
            idPrefix = 'rhsPost';
        }

        for (let i = 0; i < numReactions; i++) {
            cy.get(`#${idPrefix}_${postId}`).trigger('mouseover', {force: true}).within(() => {
                cy.wait(timeouts.HALF_SEC).get(`#recent_reaction_${i}`).should('have.attr', 'aria-label', emojis[i]);
            });
        }
    }
});
