// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import localforage from 'localforage';

import * as TIMEOUTS from '../fixtures/timeouts';
import {isMac} from '../utils';

import {ChainableT} from '../types';

// ***********************************************************
// Read more: https://on.cypress.io/custom-commands
// ***********************************************************

function logout(): ChainableT<any> {
    return cy.get('#logout').click({force: true});
}
Cypress.Commands.add('logout', logout);

function getCurrentUserId(): ChainableT<Promise<unknown>> {
    return cy.wrap(new Promise((resolve) => {
        cy.getCookie('MMUSERID').then((cookie) => {
            resolve(cookie.value);
        });
    }));
}
Cypress.Commands.add('getCurrentUserId', getCurrentUserId);

// ***********************************************************
// Key Press
// ***********************************************************

// Type Cmd or Ctrl depending on OS
function typeCmdOrCtrl(): ChainableT<any> {
    return typeCmdOrCtrlInt('#post_textbox');
}
Cypress.Commands.add('typeCmdOrCtrl', typeCmdOrCtrl);

function typeCmdOrCtrlForEdit(): ChainableT<any> {
    return typeCmdOrCtrlInt('#edit_textbox');
}
Cypress.Commands.add('typeCmdOrCtrlForEdit', typeCmdOrCtrlForEdit);

function typeCmdOrCtrlInt(textboxSelector: string) {
    let cmdOrCtrl: string;
    if (isMac()) {
        cmdOrCtrl = '{cmd}';
    } else {
        cmdOrCtrl = '{ctrl}';
    }

    return cy.get(textboxSelector).type(cmdOrCtrl, {release: false});
}

function cmdOrCtrlShortcut(subject: string, text?: string): ChainableT<any> {
    const cmdOrCtrl = isMac() ? '{cmd}' : '{ctrl}';
    return cy.get(subject).type(`${cmdOrCtrl}${text}`);
}
Cypress.Commands.add('cmdOrCtrlShortcut', {prevSubject: true}, cmdOrCtrlShortcut);

// ***********************************************************
// Post
// ***********************************************************

function postMessage(message: string): ChainableT<any> {
    cy.get('#postListContent').should('be.visible');
    return postMessageAndWait('#post_textbox', message);
}
Cypress.Commands.add('postMessage', postMessage);

function postMessageReplyInRHS(message: string): ChainableT<any> {
    cy.get('#sidebar-right').should('be.visible');
    return postMessageAndWait('#reply_textbox', message, true);
}
Cypress.Commands.add('postMessageReplyInRHS', postMessageReplyInRHS);

Cypress.Commands.add('uiPostMessageQuickly', (message) => {
    cy.uiGetPostTextBox().should('be.visible').clear().
        invoke('val', message).wait(TIMEOUTS.HALF_SEC).type(' {backspace}{enter}');
    cy.waitUntil(() => {
        return cy.uiGetPostTextBox().then((el) => {
            return el[0].textContent === '';
        });
    });
});

function postMessageAndWait(textboxSelector: string, message: string, isComment = false) {
    // Add explicit wait to let the page load freely since `cy.get` seemed to block
    // some operation which caused to prolong complete page loading.
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get(textboxSelector, {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');

    // # Type then wait for a while for the draft to be saved (async) into the local storage
    cy.get(textboxSelector).clear().type(message).wait(TIMEOUTS.ONE_SEC);

    // If posting a comment, wait for comment draft from localforage before hitting enter
    if (isComment) {
        waitForCommentDraft(message);
    }

    cy.get(textboxSelector).should('have.value', message).type('{enter}').wait(TIMEOUTS.HALF_SEC);

    cy.get(textboxSelector).invoke('val').then((value: string) => {
        if (value.length > 0 && value === message) {
            cy.get(textboxSelector).type('{enter}').wait(TIMEOUTS.HALF_SEC);
        }
    });
    return cy.waitUntil(() => {
        return cy.get(textboxSelector).then((el) => {
            return el[0].textContent === '';
        });
    });
}

interface Draft {
    value?: {
        message?: string;
    };
}

// Wait until comment message is saved as draft from the localforage
function waitForCommentDraft(message: string) {
    const draftPrefix = 'comment_draft_';

    cy.waitUntil(async () => {
        // Get all keys from localforage
        const keys = await localforage.keys();

        // Get all draft comments matching the predefined prefix
        const draftPromises = keys.
            filter((key) => key.includes(draftPrefix)).
            map((key) => localforage.getItem(key));
        const draftItems = await Promise.all(draftPromises) as string[];

        // Get the exact draft comment
        const commentDraft = draftItems.filter((item) => {
            const draft: Draft = JSON.parse(item);

            if (draft && draft.value && draft.value.message) {
                return draft.value.message === message;
            }

            return false;
        });

        return Boolean(commentDraft);
    });
}

function waitUntilPermanentPost() {
    // Add explicit wait to let the page load freely since `cy.get` seemed to block
    // some operation which caused to prolong complete page loading.
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    return cy.waitUntil(() => cy.findAllByTestId('postView').last().then((el) => !(el[0].id.includes(':'))));
}

function getLastPost(): ChainableT<JQuery> {
    waitUntilPermanentPost();

    return cy.findAllByTestId('postView').last();
}
Cypress.Commands.add('getLastPost', getLastPost);

function getLastPostId(): ChainableT<string> {
    waitUntilPermanentPost();

    return cy.findAllByTestId('postView').last().should('have.attr', 'id').and('not.include', ':').
        invoke('replace', /^[^_]*_/, '');
}
Cypress.Commands.add('getLastPostId', getLastPostId);

function uiWaitUntilMessagePostedIncludes(message: string): ChainableT<any> {
    const checkFn = () => {
        return cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes(message));
        });
    };

    // Wait for 5 seconds with 500ms check interval
    const options = {
        timeout: TIMEOUTS.FIVE_SEC,
        interval: TIMEOUTS.HALF_SEC,
        errorMsg: `Expected "${message}" to be in the last message posted but not found.`,
    };

    return cy.waitUntil(checkFn, options);
}
Cypress.Commands.add('uiWaitUntilMessagePostedIncludes', uiWaitUntilMessagePostedIncludes);

function getNthPostId(index = 0): ChainableT<string> {
    waitUntilPermanentPost();

    return cy.findAllByTestId('postView').eq(index).should('have.attr', 'id').and('not.include', ':').
        invoke('replace', /^[^_]*_/, '');
}
Cypress.Commands.add('getNthPostId', getNthPostId);

function uiGetNthPost(index: number): ChainableT<JQuery> {
    waitUntilPermanentPost();

    return cy.findAllByTestId('postView').eq(index);
}
Cypress.Commands.add('uiGetNthPost', uiGetNthPost);

function postMessageFromFile(file: string, target = '#post_textbox'): ChainableT<any> {
    return cy.fixture(file, 'utf-8').then((text) => {
        return cy.get(target).clear().invoke('val', text).wait(TIMEOUTS.HALF_SEC).type(' {backspace}{enter}').should('have.text', '');
    });
}
Cypress.Commands.add('postMessageFromFile', postMessageFromFile);

function compareLastPostHTMLContentFromFile(file: string, timeout = TIMEOUTS.TEN_SEC): ChainableT<any> {
    // * Verify that HTML Content is correct
    return cy.getLastPostId().then((postId) => {
        const postMessageTextId = `#postMessageText_${postId}`;

        return cy.fixture(file, 'utf-8').then((expectedHtml) => {
            cy.get(postMessageTextId, {timeout}).should('have.html', expectedHtml.replace(/\n$/, ''));
        });
    });
}
Cypress.Commands.add('compareLastPostHTMLContentFromFile', compareLastPostHTMLContentFromFile);

// ***********************************************************
// DM
// ***********************************************************

export interface User {
    username: string;
}

function uiGotoDirectMessageWithUser(user: User) {
    // # Open a new direct message with firstDMUser
    cy.uiAddDirectMessage().click().wait(TIMEOUTS.ONE_SEC);
    cy.findByRole('dialog', {name: 'Direct Messages'}).should('be.visible').wait(TIMEOUTS.ONE_SEC);

    // # Type username
    cy.findByRole('textbox', {name: 'Search for people'}).click({force: true}).
        type(user.username, {force: true}).wait(TIMEOUTS.ONE_SEC);

    // * Expect user count in the list to be 1
    cy.get('#multiSelectList').
        should('be.visible').
        children().
        should('have.length', 1);

    // # Select first user in the list
    cy.get('body').
        type('{downArrow}').
        type('{enter}');

    // # Click on "Go" in the group message's dialog to begin the conversation
    cy.get('#saveItems').click();

    // * Expect the channel title to be the user's username
    // In the channel header, it seems there is a space after the username, justifying the use of contains.text instead of have.text
    cy.get('#channelHeaderTitle').should('be.visible').and('contain.text', user.username);
}
Cypress.Commands.add('uiGotoDirectMessageWithUser', uiGotoDirectMessageWithUser);

function sendDirectMessageToUser(user: User, message: string) {
    cy.uiGotoDirectMessageWithUser(user);

    // # Type message and send it to the user
    cy.postMessage(message);
}
Cypress.Commands.add('sendDirectMessageToUser', sendDirectMessageToUser);

function sendDirectMessageToUsers(users: User[], message: string) {
    // # Open a new direct message
    cy.uiAddDirectMessage().click();

    users.forEach((user: User) => {
        // # Type username
        cy.get('#selectItems input').should('be.enabled').type(`@${user.username}`, {force: true});

        // * Expect user count in the list to be 1
        cy.get('#multiSelectList').
            should('be.visible').
            children().
            should('have.length', 1);

        // # Select first user in the list
        cy.get('body').
            type('{downArrow}').
            type('{enter}');
    });

    // # Click on "Go" in the group message's dialog to begin the conversation
    cy.get('#saveItems').click();

    // * Expect the channel title to be the user's username
    // In the channel header, it seems there is a space after the username, justifying the use of contains.text instead of have.text
    users.forEach((user) => {
        cy.get('#channelHeaderTitle').should('be.visible').and('contain.text', user.username);
    });

    // # Type message and send it to the user
    cy.postMessage(message);
}
Cypress.Commands.add('sendDirectMessageToUsers', sendDirectMessageToUsers);

// ***********************************************************
// Post header
// ***********************************************************

function clickPostHeaderItem(postId: string, location: string, item: string) {
    let idPrefix: string;
    switch (location) {
    case 'CENTER':
        idPrefix = 'post';
        break;
    case 'RHS_ROOT':
    case 'RHS_COMMENT':
        idPrefix = 'rhsPost';
        break;
    case 'SEARCH':
        idPrefix = 'searchResult';
        break;

    default:
        idPrefix = 'post';
    }

    if (postId) {
        cy.get(`#${idPrefix}_${postId}`).trigger('mouseover', {force: true});
        cy.wait(TIMEOUTS.HALF_SEC).get(`#${location}_${item}_${postId}`).click({force: true});
    } else {
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${idPrefix}_${lastPostId}`).trigger('mouseover', {force: true});
            cy.wait(TIMEOUTS.HALF_SEC).get(`#${location}_${item}_${lastPostId}`).click({force: true});
        });
    }
}

function clickPostTime(postId: string, location = 'CENTER') {
    clickPostHeaderItem(postId, location, 'time');
}
Cypress.Commands.add('clickPostTime', clickPostTime);

function clickPostSaveIcon(postId: string, location = 'CENTER') {
    clickPostHeaderItem(postId, location, 'flagIcon');
}
Cypress.Commands.add('clickPostSaveIcon', clickPostSaveIcon);

function clickPostDotMenu(postId: string, location = 'CENTER') {
    clickPostHeaderItem(postId, location, 'button');
}
Cypress.Commands.add('clickPostDotMenu', clickPostDotMenu);

function clickPostReactionIcon(postId: string, location = 'CENTER') {
    clickPostHeaderItem(postId, location, 'reaction');
}
Cypress.Commands.add('clickPostReactionIcon', clickPostReactionIcon);

function clickPostCommentIcon(postId: string, location = 'CENTER') {
    clickPostHeaderItem(postId, location, 'commentIcon');
}
Cypress.Commands.add('clickPostCommentIcon', clickPostCommentIcon);

// ***********************************************************
// Teams
// ***********************************************************

function createNewTeam(teamName: string, teamURL: string) {
    cy.visit('/create_team');
    cy.get('#teamNameInput').type(teamName).type('{enter}');
    cy.get('#teamURLInput').type(teamURL).type('{enter}');
    cy.visit(`/${teamURL}`);
}
Cypress.Commands.add('createNewTeam', createNewTeam);

function getCurrentTeamURL(siteURL: string): ChainableT<string> {
    let path: string;

    // siteURL can be provided for cases where subpath is being tested
    if (siteURL) {
        path = window.location.href.substring(siteURL.length);
    } else {
        path = window.location.pathname;
    }

    const result = path.split('/', 2);
    return cy.wrap(`/${(result[0] ? result[0] : result[1])}`); // sometimes the first element is empty if path starts with '/'
}
Cypress.Commands.add('getCurrentTeamURL', getCurrentTeamURL);

function leaveTeam() {
    // # Open team menu and click "Leave Team"
    cy.uiOpenTeamMenu('Leave Team');

    // * Check that the "leave team modal" opened up
    cy.get('#leaveTeamModal').should('be.visible');

    // # click on yes
    cy.get('#leaveTeamYes').click();

    // * Check that the "leave team modal" closed
    cy.get('#leaveTeamModal').should('not.exist');
}
Cypress.Commands.add('leaveTeam', leaveTeam);

// ***********************************************************
// Text Box
// ***********************************************************

function clearPostTextbox(channelName = 'town-square') {
    cy.get(`#sidebarItem_${channelName}`).click({force: true});
    cy.uiGetPostTextBox().clear();
}
Cypress.Commands.add('clearPostTextbox', clearPostTextbox);

// ***********************************************************
// Min Setting View
// ************************************************************

function minDisplaySettings() {
    cy.get('#themeTitle').should('be.visible', 'contain', 'Theme');
    cy.get('#themeEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#clockTitle').should('be.visible', 'contain', 'Clock Display');
    cy.get('#clockEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#name_formatTitle').should('be.visible', 'contain', 'Teammate Name Display');
    cy.get('#name_formatEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#collapseTitle').should('be.visible', 'contain', 'Default appearance of image previews');
    cy.get('#collapseEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#message_displayTitle').scrollIntoView().should('be.visible', 'contain', 'Message Display');
    cy.get('#message_displayEdit').should('be.visible', 'contain', 'Edit');

    cy.get('#languagesTitle').scrollIntoView().should('be.visible', 'contain', 'Language');
    cy.get('#languagesEdit').should('be.visible', 'contain', 'Edit');
}
Cypress.Commands.add('minDisplaySettings', minDisplaySettings);

// ***********************************************************
// Change User Status
// ************************************************************

function userStatus(statusInt: number) {
    cy.get('.status-wrapper.status-selector').click();
    cy.get('.MenuItem').eq(statusInt).click();
}
Cypress.Commands.add('userStatus', userStatus);

// ***********************************************************
// Channel
// ************************************************************

function getCurrentChannelId(): ChainableT<string> {
    return cy.get('#channel-header', {timeout: TIMEOUTS.HALF_MIN}).invoke('attr', 'data-channelid');
}
Cypress.Commands.add('getCurrentChannelId', getCurrentChannelId);

function updateChannelHeader(text: string) {
    cy.get('#channelHeaderDropdownIcon').
        should('be.visible').
        click();
    cy.get('.Menu__content').
        should('be.visible').
        find('#channelEditHeader').
        click();
    cy.get('#edit_textbox').
        clear().
        type(text).
        type('{enter}').
        wait(TIMEOUTS.HALF_SEC);
}

Cypress.Commands.add('updateChannelHeader', updateChannelHeader);

function checkRunLDAPSync(): ChainableT<any> {
    return cy.apiGetLDAPSync().then((response) => {
        const jobs = response.body;
        const currentTime = new Date();

        // # Run LDAP Sync if no job exists (or) last status is an error (or) last run time is more than 1 day old
        if (jobs.length === 0 || jobs[0].status === 'error' || ((currentTime.getTime() - (new Date(jobs[0].last_activity_at)).getTime()) > 8640000)) {
            // # Go to system admin LDAP page and run the group sync
            cy.visit('/admin_console/authentication/ldap');

            // # Click on AD/LDAP Synchronize Now button and verify if succesful
            cy.findByText('AD/LDAP Test').click();
            cy.findByText('AD/LDAP Test Successful').should('be.visible');

            // # Click on AD/LDAP Synchronize Now button
            cy.findByText('AD/LDAP Synchronize Now').click().wait(TIMEOUTS.ONE_SEC);

            // * Get the First row
            cy.findByTestId('jobTable').
                find('tbody > tr').
                eq(0).
                as('firstRow');

            // * Wait until first row updates to say Success
            cy.waitUntil(() => {
                return cy.get('@firstRow').then((el) => {
                    return el.find('.status-icon-success').length > 0;
                });
            }
            , {
                timeout: TIMEOUTS.FIVE_MIN,
                interval: TIMEOUTS.TWO_SEC,
                errorMsg: 'AD/LDAP Sync Job did not finish',
            });
        }
    });
}
Cypress.Commands.add('checkRunLDAPSync', checkRunLDAPSync);

function clickEmojiInEmojiPicker(emojiName: string) {
    cy.get('#emojiPicker').should('exist').and('be.visible').within(() => {
        // # Mouse over the emoji to get it selected
        cy.findAllByTestId(emojiName).eq(0).trigger('mouseover', {force: true});

        // * Verify that preview shows the emoji selected
        cy.findAllByTestId('emoji_picker_preview').eq(0).should('exist').and('be.visible').contains(emojiName, {matchCase: false});

        // # Click on the emoji
        cy.findAllByTestId(emojiName).eq(0).click({force: true});
    });
}
Cypress.Commands.add('clickEmojiInEmojiPicker', clickEmojiInEmojiPicker);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * log out user
             *
             * @example
             *   cy.logout();
             */
            logout: typeof logout;

            /**
             * Wait for a message to get posted as the last post.
             * @returns {string} returns true if found or fail a test if not.
             *
             * @example
             *   cy.getCurrentUserId().then((id) => {
             */
            getCurrentUserId: typeof getCurrentUserId;

            /**
             * Types `{cmd}` mac / `{ctrl}` windows into post textbox
             */
            typeCmdOrCtrl: typeof typeCmdOrCtrl;

            /**
             * Types `{cmd}` mac / `{ctrl}` windows into edit post textbox
             */
            typeCmdOrCtrlForEdit: typeof typeCmdOrCtrlForEdit;

            cmdOrCtrlShortcut: typeof cmdOrCtrlShortcut;

            postMessage: typeof postMessage;

            postMessageReplyInRHS: typeof postMessageReplyInRHS;

            /**
             * Wait for a message to get posted as the last post.
             * @param {string} message - message to check if includes in the last post
             * @returns {boolean} returns true if found or fail a test if not.
             *
             * @example
             *   const message = 'message';
             *   cy.postMessage(message);
             *   cy.uiWaitUntilMessagePostedIncludes(message);
             */
            uiWaitUntilMessagePostedIncludes: typeof uiWaitUntilMessagePostedIncludes;

            /**
             * Get nth post from the post list
             * @param {number} index - an identifier of a post
             * - zero (0)         : oldest post
             * - positive number  : from old to latest post
             * - negative number  : from new to oldest post
             * @returns {JQuery} response: Cypress-chainable JQuery
             *
             * @example
             *   cy.uiGetNthPost(-1);
             */
            uiGetNthPost: typeof uiGetNthPost;

            /**
             * Post message via center textbox by directly injected in the textbox
             * @param {string} message - message to be posted
             * @returns void
             *
             * @example
             *  cy.uiPostMessageQuickly('Hello world')
             */
            uiPostMessageQuickly(message: string): void;

            /**
             * Clicks on a visible emoji in the emoji picker.
             * For emojis further down the page, search for that emoji in search bar and then use this command to click on it.
             * @param {string} emojiName - The name of emoji to click. For emojis with multiple names concat with ','. eg. slightly_frowning_face
             * @returns void
             *
             * @example
             *  cy.uiClickSystemEmoji('slightly_frowning_face');
             *  cy.uiClickSystemEmoji('star-struck,grinning_face_with_star_eyes');
             */
            clickEmojiInEmojiPicker(emojiName: string): ChainableT<void>;

            /**
             * Get nth post from the post list
             * @returns {JQuery} response: Cypress-chainable JQuery
             *
             * @example
             *   cy.getLastPost().then((el: Element) => {;
             */
            getLastPost: typeof getLastPost;

            /**
             * Get nth post from the post list
             * @returns {string} response: Cypress-chainable string
             *
             * @example
             *   cy.getLastPostId().then((postId) => {
             */
            getLastPostId: typeof getLastPostId;

            /**
            * Get post ID based on index of post list
            * zero (0)         : oldest post
            * positive number  : from old to latest post
            * negative number  : from new to oldest post
            */
            getNthPostId: typeof getNthPostId;

            /**
             * Post message from a file instantly post a message in a textbox
             * instead of typing into it which takes longer period of time.
             */
            postMessageFromFile: typeof postMessageFromFile;

            /**
             * Compares HTML content of a last post against the given file
             * instead of typing into it which takes longer period of time.
             */
            compareLastPostHTMLContentFromFile: typeof compareLastPostHTMLContentFromFile;

            /**
             * Go to a DM channel with a given user
             * @param {User} user - the user that should get the message
             * @example
             *   const user = {username: 'bob'};
             *   cy.uiGotoDirectMessageWithUser(user);
             */
            uiGotoDirectMessageWithUser(user: User): ChainableT<void>;

            /**
             * Sends a DM to a given user
             * @param {User} user - the user that should get the message
             * @param {String} message - the message to send
             */
            sendDirectMessageToUser: typeof sendDirectMessageToUser;

            /**
             * Sends a GM to a given user list
             * @param {User[]} users - the users that should get the message
             * @param {String} message - the message to send
             */
            sendDirectMessageToUsers(users: User[], message: string): ChainableT<any>;

            /**
             * Click post time
             * @param {String} postId - Post ID
             * @param {String} location - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
             */
            clickPostTime(postId: string, location: string): ChainableT<void>;

            /**
             * Click save icon by post ID or to most recent post (if post ID is not provided)
             * @param {String} postId - Post ID
             * @param {String} [location] - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
             */
            clickPostSaveIcon(postId: string, location?: string): ChainableT<void>;

            /**
             * Click dot menu by post ID or to most recent post (if post ID is not provided)
             * @param {String} [postId] - Post ID
             * @param {String} [location] - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT', 'SEARCH'
             */
            clickPostDotMenu(postId?: string, location?: string): ChainableT<void>;

            /**
             * Click post reaction icon
             * @param {String} postId - Post ID
             * @param {String} [location] - as 'CENTER', 'RHS_ROOT', 'RHS_COMMENT'
             */
            clickPostReactionIcon(postId?: string, location?: string): ChainableT<void>;

            /**
             * Click comment icon by post ID or to most recent post (if post ID is not provided)
             * This open up the RHS
             * @param {String} postId - Post ID
             * @param {String} [location] - as 'CENTER', 'SEARCH'
             */
            clickPostCommentIcon(postId: string, location?: string): ChainableT<void>;

            createNewTeam(teamName: string, teamURL: string): ChainableT<void>;

            getCurrentTeamURL: typeof getCurrentTeamURL;

            leaveTeam(): ChainableT<void>;

            clearPostTextbox(channelName: string): ChainableT<void>;

            /**
             * Checking min setting view for display
             */
            minDisplaySettings(): ChainableT<void>;

            /**
             * Set the user's status
             * Need to be in main channel view for this to work
             * 0 = Online
             * 1 = Away
             * 2 = Do Not Disturb
             * 3 = Offline
             */
            userStatus(statusInt: number): ChainableT<void>;

            getCurrentChannelId: typeof getCurrentChannelId;

            /**
             * Update channel header
             * @param {String} text - Text to set the header to
             */
            updateChannelHeader(text: string): ChainableT<void>;

            /**
             * Navigate to system console-PluginManagement from account settings
             */
            checkRunLDAPSync: typeof checkRunLDAPSync;
        }
    }
}
