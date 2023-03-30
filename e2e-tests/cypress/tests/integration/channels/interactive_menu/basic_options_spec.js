// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @interactive_menu

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

import messageMenusOptions from '../../../fixtures/interactive_message_menus_options.json';
import {getMessageMenusPayload} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

const options = [
    {text: 'Option 1', value: 'option1'},
    {text: 'Option 2', value: 'option2'},
    {text: 'Option 3', value: 'option3'},
];

describe('Interactive Menu', () => {
    let testUser;
    let otherUser;
    let longUser;
    let testChannel;
    let incomingWebhook;
    let teamId;

    before(() => {
        cy.requireWebhookServer();

        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testChannel = channel;
            teamId = team.id;

            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });

            const longUsername = 'with-long-username-abcdefghijklmnopqrstuvwxyz-123456789';
            cy.apiCreateUser({prefix: longUsername}).then(({user: user3}) => {
                longUser = user3;
                cy.apiAddUserToTeam(team.id, longUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, longUser.id);
                });
            });

            const newIncomingHook = {
                channel_id: testChannel.id,
                channel_locked: true,
                description: 'Incoming webhook interactive menu',
                display_name: 'menuIn' + Date.now(),
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/${testChannel.name}`);
        });
    });

    it('matches elements', () => {
        // # Post an incoming webhook
        const payload = getMessageMenusPayload({options});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // # Get message attachment from the last post
        cy.getLastPostId().then((postId) => {
            cy.get(`#messageAttachmentList_${postId}`).as('messageAttachmentList');
        });

        // * Verify each element of message attachment list
        cy.get('@messageAttachmentList').scrollIntoView().within(() => {
            cy.get('.attachment__thumb-pretext').should('be.visible').and('have.text', payload.attachments[0].pretext);
            cy.get('.post-message__text-container').should('be.visible').and('have.text', payload.attachments[0].text);
            cy.get('.attachment-actions').should('be.visible');
            cy.get('.select-suggestion-container').should('be.visible');

            // * Suggestion list should not be visible before dropdown is clicked
            cy.get('#suggestionList').should('not.exist');

            // # Click on the suggestion dropdown input
            cy.findByPlaceholderText('Select an option...').scrollIntoView().should('be.visible').click();

            // * Suggestion list should now be open
            cy.get('#suggestionList').should('be.visible').children().should('have.length', options.length);

            cy.get('#suggestionList').children().each(($el, index) => {
                cy.wrap($el).should('have.text', options[index].text);
            });
        });

        // * Close suggestion list by clicking on other element
        cy.get('body').click();
    });

    it('MM-T1736 - Selected Option is displayed, Ephemeral message is posted', () => {
        // # Post an incoming webhook
        const payload = getMessageMenusPayload({options});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // # Get message attachment from the last post
        cy.getLastPostId().then((postId) => {
            cy.get(`#messageAttachmentList_${postId}`).within(() => {
                // # Select option 1 by typing exact text and press enter
                cy.findByPlaceholderText('Select an option...').scrollIntoView().click().clear({force: true}).type(`${options[0].text}{enter}`);

                // * Verify that the input is updated with the selected option
                cy.findByDisplayValue(options[0].text).should('exist');
            });
        });

        // # Checking if we got the ephemeral message with the selection we made
        verifyEphemeralMessage('Ephemeral | select option: option1');
    });

    it('MM-T1737 - Reply is displayed in center channel with "commented on [user\'s] message: [text]"', () => {
        // # Post an incoming webhook
        const payload = getMessageMenusPayload({options});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // # Get last post
        cy.getLastPostId().then((parentMessageId) => {
            // # Post another message
            cy.postMessageAs({sender: otherUser, message: 'Just another message', channelId: testChannel.id});

            // # Click comment icon to open RHS
            cy.clickPostCommentIcon(parentMessageId);

            // * Check that the RHS is open
            cy.get('#rhsContainer').should('be.visible');

            // # Have another user reply to the webhook message
            cy.postMessageAs({sender: otherUser, message: 'Reply to webhook', channelId: testChannel.id, rootId: parentMessageId});

            // # Get the latest post
            cy.getLastPostId().then((replyMessageId) => {
                // * Verify that the reply is in the channel view with matching text
                cy.get(`#post_${replyMessageId}`).within(() => {
                    cy.get('.post__link').should('be.visible').and('have.text', `Commented on sysadmin's message: ${payload.attachments[0].pretext}`);
                    cy.get(`#postMessageText_${replyMessageId}`).should('be.visible').and('have.text', 'Reply to webhook');
                });

                // * Verify that the reply is in the RHS with matching text
                cy.get(`#rhsPost_${replyMessageId}`).within(() => {
                    cy.get('.post__link').should('not.exist');
                    cy.get(`#rhsPostMessageText_${replyMessageId}`).should('be.visible').and('have.text', 'Reply to webhook');
                });

                // # Close RHS
                cy.uiCloseRHS();
            });
        });
    });

    it('MM-T1743 - Searching within the list of options', () => {
        const searchOptions = [
            {text: 'SearchOption1', value: 'searchoption1'},
            {text: 'SearchOption2', value: 'searchoption2'},
            ...options,
        ];
        const searchOptionsPayload = getMessageMenusPayload({options: searchOptions});

        // # Post an incoming webhook for interactive menu with search options
        cy.postIncomingWebhook({url: incomingWebhook.url, data: searchOptionsPayload, waitFor: 'attachment-pretext'});

        // # Get message attachment from the last post
        cy.getLastPostId().then((postId) => {
            cy.get(`#messageAttachmentList_${postId}`).as('messageAttachmentList');
        });

        cy.get('@messageAttachmentList').within(() => {
            cy.findByPlaceholderText('Select an option...').scrollIntoView().click().clear({force: true}).type('sea');

            // * Message attachment menu dropdown should now be open
            cy.get('#suggestionList').should('exist').children().should('have.length', 2);

            // # Checking values inside the attachment menu dropdown
            cy.get('#suggestionList').within(() => {
                // * Each dropdown should contain the searchOptions text
                cy.findByText(searchOptions[0].text).should('exist');
                cy.findByText(searchOptions[1].text).should('exist');
            });
        });
    });

    it('MM-T1746 - No items match feedback', () => {
        const missingUser = Date.now();
        const userOptions = getMessageMenusPayload({dataSource: 'users'});

        // # Post an incoming webhook for interactive menu with user options
        cy.postIncomingWebhook({url: incomingWebhook.url, data: userOptions, waitFor: 'attachment-pretext'});

        // # Get message attachment from the last post
        cy.getLastPostId().then((postId) => {
            cy.get(`#messageAttachmentList_${postId}`).within(() => {
                // # Type the missing user in the select input
                cy.findByPlaceholderText('Select an option...').scrollIntoView().click().clear({force: true}).type(missingUser);

                cy.get('#suggestionList').within(() => {
                    // * Check if we get appropriate message when no options matches entered text
                    cy.get('.suggestion-list__no-results').should('be.visible').should('have.text', `No items match ${missingUser}`);
                });
            });
        });
    });

    it('MM-T1742 - Using up/down arrow keys to make selection', () => {
        const basicOptions = getMessageMenusPayload({options});

        // # Post an incoming webhook for interactive menu with basic options
        cy.postIncomingWebhook({url: incomingWebhook.url, data: basicOptions, waitFor: 'attachment-pretext'});

        // # Get message attachment from the last post
        cy.getLastPostId().then((postId) => {
            cy.get(`#messageAttachmentList_${postId}`).as('messageAttachmentList');
        });

        cy.get('@messageAttachmentList').within(() => {
            cy.findByPlaceholderText('Select an option...').scrollIntoView().as('optionInputField');
            cy.get('@optionInputField').click();
            cy.get('#suggestionList').should('be.visible');

            // # Hit the down arrow two times
            cy.get('@optionInputField').type('{downarrow}{downarrow}');

            // # Verify the correct option has been selected
            cy.get('#suggestionList').within(() => {
                cy.get('.suggestion--selected').should('have.text', options[2].text);
            });

            // # Hit the up arrow two times
            cy.get('@optionInputField').type('{uparrow}{uparrow}');

            // # Verify the correct option has been selected
            cy.get('#suggestionList').within(() => {
                cy.get('.suggestion--selected').should('have.text', options[0].text);
            });
        });
    });

    it('should truncate properly the selected long basic option', () => {
        const withLongBasicOption = [
            {text: 'Option 0 - This is with very long option', value: 'option0'},
            ...options,
        ];
        const basicOptions = getMessageMenusPayload({options: withLongBasicOption});

        // # Post an incoming webhook for interactive menu with basic options and verify the post
        cy.postIncomingWebhook({url: incomingWebhook.url, data: basicOptions, waitFor: 'attachment-pretext'}).then(() => {
            verifyLastPost();
        });
    });

    it('should truncate properly the selected long username option', () => {
        const userOptions = getMessageMenusPayload({dataSource: 'users'});

        // # Post an incoming webhook for interactive menu with user options and verify the post
        cy.postIncomingWebhook({url: incomingWebhook.url, data: userOptions, waitFor: 'attachment-pretext'}).then(() => {
            verifyLastPost();
        });
    });

    it('should truncate properly the selected long channel display name option', () => {
        const channelOptions = getMessageMenusPayload({dataSource: 'channels'});

        // # Create channel with long display name
        cy.apiCreateChannel(teamId, 'test-channel', `AAAA Very Long Display Name of a Channel ${Date.now()}`).then(() => {
            // # Post an incoming webhook for interactive menu with channel options and verify the post
            cy.postIncomingWebhook({url: incomingWebhook.url, data: channelOptions, waitFor: 'attachment-pretext'}).then(() => {
                verifyLastPost();
            });
        });
    });

    it('MM-T1740 - Clicking in / Tapping on the message attachment menu box opens list of selections', () => {
        // # Create a message attachment with menu
        const basicOptionPayload = getMessageMenusPayload({options});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: basicOptionPayload, waitFor: 'attachment-pretext'});

        // # Get the last posted message id
        cy.getLastPostId().then((lastPostId) => {
            // # Get the last messages attachment container
            cy.get(`#messageAttachmentList_${lastPostId}`).within(() => {
                // * Message attachment menu dropdown should be closed
                cy.get('#suggestionList').should('not.exist');

                // // # Open the message attachment menu dropdown
                cy.findByPlaceholderText('Select an option...').scrollIntoView().click();

                // * Message attachment menu dropdown should now be open
                cy.get('#suggestionList').should('exist').children().should('have.length', options.length);

                // # Checking values inside the attachment menu dropdown
                cy.get('#suggestionList').within(() => {
                    // * Each dropdown should contain the options text
                    cy.findByText(options[0].text).should('exist');
                    cy.findByText(options[1].text).should('exist');
                    cy.findByText(options[2].text).should('exist');
                });
            });

            // # Close message attachment menu dropdown
            cy.get('body').click();
        });
    });

    it('MM-T1745 - Enter selects the option', () => {
        // # Create a message attachment with menu
        const distinctOptions = messageMenusOptions['distinct-options'];
        const distinctOptionsPayload = getMessageMenusPayload({options: distinctOptions});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: distinctOptionsPayload, waitFor: 'attachment-pretext'});

        // # Get the last posted message id
        cy.getLastPostId().then((lastPostId) => {
            // # Get the last messages attachment container
            cy.get(`#messageAttachmentList_${lastPostId}`).within(() => {
                // # Find the message attachment menu and assign it to a variable for later use
                cy.findByPlaceholderText('Select an option...').scrollIntoView().as('optionInputField');

                // # Open the options menu
                cy.get('@optionInputField').click();

                // * Message attachment menu dropdown should now be open
                cy.get('#suggestionList').should('exist').children().should('have.length', distinctOptions.length);

                // # Lets make the last option we are interested in finding
                const selectedOption = distinctOptions[5].text;

                // # Type the selected word to find in the list
                cy.get('@optionInputField').type(selectedOption);

                // # Checking values inside the attachment menu dropdown
                cy.get('#suggestionList').within(() => {
                    // * All other options should not be there
                    cy.findByText(distinctOptions[0].text).should('not.exist');
                    cy.findByText(distinctOptions[1].text).should('not.exist');
                    cy.findByText(distinctOptions[2].text).should('not.exist');
                    cy.findByText(distinctOptions[3].text).should('not.exist');
                    cy.findByText(distinctOptions[4].text).should('not.exist');

                    // * Selected option should be there in the search list
                    cy.findByText(selectedOption).should('exist');

                    // * Other matched option should also be there
                    cy.findByText(distinctOptions[6].text).should('exist');
                });

                // # Enter is clicked to select the correct match
                cy.get('@optionInputField').type('{enter}');

                // * Since option was clicked dropdown should be closed
                cy.get('#suggestionList').should('not.exist');

                // * Verify the input has the selected value
                cy.findByDisplayValue(selectedOption).should('exist');
            });
        });

        // # Get the ephemeral message from webhook, which is only visible to us
        verifyEphemeralMessage('Ephemeral | select option: mango');
    });

    it('MM-T1741 - Long lists of selections are scrollable', () => {
        const manyOptions = messageMenusOptions['many-options'];
        const manyOptionsPayload = getMessageMenusPayload({options: manyOptions});

        // # Create a message attachment with long menu options
        cy.postIncomingWebhook({url: incomingWebhook.url, data: manyOptionsPayload, waitFor: 'attachment-pretext'});

        // # Get the last posted message id
        cy.getLastPostId().then((lastPostId) => {
            // # Get the last messages attachment container
            cy.get(`#messageAttachmentList_${lastPostId}`).within(() => {
                // * Message attachment menu dropdown should be closed
                cy.get('#suggestionList').should('not.exist');

                // // # Open the message attachment menu dropdown
                cy.findByPlaceholderText('Select an option...').scrollIntoView().click();

                // * Message attachment menu dropdown should now be open
                cy.get('#suggestionList').should('exist').children().should('have.length', manyOptions.length);

                const lenghtOfLongListOptions = manyOptions.length;

                // # Scroll to bottom of the options
                cy.get('#suggestionList').scrollTo('bottom').then((listContainer) => {
                    // * When scrolled to bottom, the top options should be not visible but should exist in dom
                    cy.findByText(manyOptions[0].text, {listContainer}).should('exist').and('not.be.visible');
                    cy.findByText(manyOptions[1].text, {listContainer}).should('exist').and('not.be.visible');

                    // # But the last options should be visible
                    cy.findByText(manyOptions[lenghtOfLongListOptions - 1].text, {listContainer}).scrollIntoView().should('exist').and('be.visible');
                    cy.findByText(manyOptions[lenghtOfLongListOptions - 2].text, {listContainer}).scrollIntoView().should('exist').and('be.visible');
                });

                // # Scroll to top of the options
                cy.get('#suggestionList').scrollTo('top').then((listContainer) => {
                    // * When scrolled to top, the bottom options should be not visible
                    cy.findByText(manyOptions[lenghtOfLongListOptions - 1].text, {listContainer}).should('not.be.visible');
                    cy.findByText(manyOptions[lenghtOfLongListOptions - 2].text, {listContainer}).should('not.be.visible');

                    // # But the top options should be visible
                    cy.findByText(manyOptions[0].text, {listContainer}).should('be.visible');
                    cy.findByText(manyOptions[1].text, {listContainer}).should('be.visible');
                });
            });

            // # Close message attachment menu dropdown
            cy.get('body').click();
        });
    });

    it('MM-T1747 - Selection is mirrored in RHS / Message Thread', () => {
        // # Create a webhook with distinct options
        const distinctOptions = messageMenusOptions['distinct-options'];
        const distinctListOptionPayload = getMessageMenusPayload({options: distinctOptions});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: distinctListOptionPayload, waitFor: 'attachment-pretext'});

        const selectedItem = distinctOptions[2].text;
        const firstFewLettersOfSelectedItem = selectedItem.substring(0, 3); // Make sure the options have minimum length of 3

        // # Get the last posted message id
        cy.getLastPostId().then((lastPostId) => {
            // # Get the last messages attachment container
            cy.get(`#messageAttachmentList_${lastPostId}`).within(() => {
                // # Start typing only first few letters in the input
                cy.findByPlaceholderText('Select an option...').scrollIntoView().clear({force: true}).type(firstFewLettersOfSelectedItem).wait(TIMEOUTS.ONE_SEC);

                // * Message attachment dropdown with the selected item should be visible
                cy.get('#suggestionList').should('exist').within(() => {
                    cy.findByText(selectedItem).should('exist');
                });

                // # Now that we know selected option appeared in the list, Click enter on input field
                cy.findByPlaceholderText('Select an option...').scrollIntoView().type('{enter}');

                // * Verify the input has the selected value
                cy.findByDisplayValue(selectedItem).should('exist');
            });
        });

        // # Checking if we got the ephemeral message with the selection we made
        verifyEphemeralMessage('Ephemeral | select option: banana');

        cy.getNthPostId(-2).then((webhookMessageId) => {
            // # Click on reply icon to open message in RHS
            cy.clickPostCommentIcon(webhookMessageId);

            // * Verify RHS has opened
            cy.get('#rhsContainer').should('exist');

            // # Same id as parent post in center, only opened in RHS
            cy.get(`#rhsPost_${webhookMessageId}`).within(() => {
                // * Verify the input has the selected value same as that of Center
                cy.findByDisplayValue(selectedItem).should('exist');
            });

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T1748 - Change selection in RHS / Message Thread', () => {
        // # Create a webhook with distinct options
        const distinctOptions = messageMenusOptions['distinct-options'];
        const distinctListOptionPayload = getMessageMenusPayload({options: distinctOptions});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: distinctListOptionPayload, waitFor: 'attachment-pretext'});

        const firstSelectedItem = distinctOptions[2].text;
        const secondSelectedItem = distinctOptions[7].text;

        // # Verify the webhook posted the message
        cy.getLastPostId().then((parentPostId) => {
            // # Get the last messages attachment container
            cy.get(`#messageAttachmentList_${parentPostId}`).within(() => {
                // # Open the message attachment menu dropdown by clicking on input
                cy.findByPlaceholderText('Select an option...').scrollIntoView().click();

                // * Message attachment dropdown with the selected item should be visible
                cy.get('#suggestionList').should('exist').within(() => {
                    // # Make a first selection from the given options
                    cy.findByText(firstSelectedItem).should('exist').click();
                });

                // * Verify the input has the selected value you clicked
                cy.findByDisplayValue(firstSelectedItem).should('exist');
            });

            // # Checking if we got the ephemeral message with the selection we made
            verifyEphemeralMessage('Ephemeral | select option: banana');

            // # Click on reply icon to original message with attachment message in RHS
            cy.clickPostCommentIcon(parentPostId);

            // * Verify RHS has opened
            cy.get('#rhsContainer').should('exist');

            // # Same id as parent post in center should be opened in RHS since we clicked reply button
            cy.get(`#rhsPost_${parentPostId}`).within(() => {
                // * Verify the input has the selected value same as that of Center and open dropdown to make new selection
                cy.findByDisplayValue(firstSelectedItem).should('exist').click();

                // * Message attachment dropdown with the selected item should be visible
                cy.get('#suggestionList').should('exist').within(() => {
                    // # Make a second selection different from first from options
                    cy.findByText(secondSelectedItem).should('exist').click();
                });

                // * Verify the input has the new selected value in the RHS message
                cy.findByDisplayValue(secondSelectedItem).should('exist');
            });

            // * Verify the original message with attacment's selection is also changed
            cy.get(`#messageAttachmentList_${parentPostId}`).within(() => {
                // * Verify the input in center has the new selected value i.e secondSelectedItem
                cy.findByDisplayValue(secondSelectedItem).should('exist');
            });

            // # Checking if we got updated ephemeral message with the new selection we made
            verifyEphemeralMessage('Ephemeral | select option: avocado');

            cy.uiCloseRHS();
        });
    });

    it('MM-T1738 - Selected options with long usernames are not cut off in the RHS', () => {
        // # Make webhook request to get list of all the users
        const userOptions = getMessageMenusPayload({dataSource: 'users'});
        cy.postIncomingWebhook({url: incomingWebhook.url, data: userOptions, waitFor: 'attachment-pretext'});

        // # Go to last webhook message with users list
        cy.getLastPostId().then((lastPostId) => {
            // # Get the last messages attachment container
            cy.get(`#messageAttachmentList_${lastPostId}`).within(() => {
                // # Find and select the user, we just added
                cy.findByPlaceholderText('Select an option...').scrollIntoView().clear({force: true}).type(longUser.username);

                cy.get('#suggestionList').within(() => {
                    // * Newly added username should be there in the search list
                    cy.findByText(`@${longUser.username}`).should('exist').click({force: true});
                });

                // * Verify the input has the complete username value
                cy.findByDisplayValue(longUser.username).should('exist');
            });

            // # Click on reply icon to open message in RHS
            cy.clickPostCommentIcon(lastPostId);

            // * Verify RHS has opened
            cy.get('#rhsContainer').should('exist');

            // # Same id as parent post in center, only opened in RHS
            cy.get(`#rhsPost_${lastPostId}`).within(() => {
                // * Verify the input has the selected value same as that of Center
                //   and verify that it has truncation css applied
                cy.findByDisplayValue(longUser.username).should('exist').and('have.css', 'text-overflow', 'ellipsis');
            });

            // # Close RHS
            cy.uiCloseRHS();
        });
    });
});

function verifyMessageAttachmentList(postId, isRhs, text) {
    cy.get(`#messageAttachmentList_${postId}`).within(() => {
        cy.findByTestId('autoCompleteSelector').should('be.visible');

        if (isRhs) {
            // * Verify that the selected option from center view matches the one in RHS
            cy.findByPlaceholderText('Select an option...').scrollIntoView().should('have.value', text);
        } else {
            // # Select an option (long) in center view
            cy.findByPlaceholderText('Select an option...').scrollIntoView().should('be.visible').click();
            cy.get('#suggestionList').should('be.visible').children().first().click({force: true});
        }

        // * Verify exact height, width and padding of suggestion container and its input
        cy.get('.select-suggestion-container').
            should('be.visible').
            and('have.css', 'height', '32px').
            and('have.css', 'width', '220px');

        cy.findByPlaceholderText('Select an option...').scrollIntoView().
            and('have.css', 'height', '32px').
            and('have.css', 'width', '220px').
            and('have.css', 'padding-right', '30px');

        cy.findByPlaceholderText('Select an option...').scrollIntoView().invoke('attr', 'value').then((value) => {
            cy.wrap(value).as('optionValue');
        });
    });
}

function verifyLastPost() {
    // # Get message attachment from the last post, and
    // * Verify its content in center view
    cy.getLastPostId().then((postId) => {
        verifyMessageAttachmentList(postId, false);

        // # Open the same post in RHS, and
        // * Verify its content in RHS
        cy.clickPostCommentIcon(postId);
        cy.get(`#rhsPost_${postId}`).within(() => {
            cy.get('@optionValue').then((value) => {
                verifyMessageAttachmentList(postId, true, value);
            });
        });

        // # Close the RHS
        cy.uiCloseRHS();
    });
}

function verifyEphemeralMessage(message) {
    // # Checking if we got the ephemeral message with the selection we made
    cy.wait(TIMEOUTS.HALF_SEC).getLastPostId().then((botLastPostId) => {
        cy.get(`#post_${botLastPostId}`).within(() => {
            // * Check if Bot message only visible to you
            cy.findByText('(Only visible to you)').should('exist');

            // * Check if we got ephemeral message of our selection
            cy.findByText(message).should('exist');
        });
    });
}
