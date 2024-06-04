// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel @channel_bookmarks
// node run_tests.js --group='@channel'

import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Channel Bookmarks', () => {
    let testTeam: Cypress.Team;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let user1: Cypress.UserProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let admin: Cypress.UserProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let channel: Cypress.Channel;

    before(() => {
        cy.apiGetMe().then(({user: adminUser}) => {
            admin = adminUser;

            cy.apiInitSetup().then(({team, user}) => {
                testTeam = team;
                user1 = user;

                cy.visit(`/${testTeam.name}/channels/town-square`);
                cy.getCurrentChannelId().then((channelId) => {
                    cy.makeClient().then(async (client) => {
                        channel = await client.getChannel(channelId);
                    });
                });
            });
        });
    });

    it('create link bookmark', () => {
        // # Create link
        const {link, realLink} = createLinkBookmark();

        cy.findByTestId('channel-bookmarks-container').within(() => {
            // * Verify href
            cy.findByRole('link', {name: link}).should('have.attr', 'href', realLink);
        });
    });

    it('create link bookmark, with emoji and custom title', () => {
        const {realLink, displayName, emojiName} = createLinkBookmark({displayName: 'custom display name', emojiName: 'smile'});

        cy.findByTestId('channel-bookmarks-container').within(() => {
            // * Verify emoji, displayname, and href
            cy.findAllByRole('link', {name: `:${emojiName}: ${displayName}`}).should('have.attr', 'href', realLink);
        });
    });

    it('create file bookmark, and open preview', () => {
        // # Create bookmark
        const {file} = createFileBookmark({file: 'small-image.png'});

        // * Verify preview icon
        cy.findAllByRole('link', {name: file}).as('link').find('.file-icon.image');

        // # Open preview
        cy.get('@link').click();

        // * Verify preview opened
        cy.get('.file-preview-modal').findByRole('heading', {name: file});
        cy.get('.file-preview-modal__file-details-user-name').should('have.text', admin.username);
        cy.get('.file-preview-modal__channel').should('have.text', `Shared in ~${channel.display_name}`);
        cy.get('.icon-close').click();
    });

    it('create file bookmark, progress and cancel upload', () => {
        const file = 'powerpointx-file.pptx';

        cy.intercept(
            {method: 'POST', pathname: 'files', middleware: true, times: 1},
            () => {
                return new Promise((resolve) =>
                    setTimeout(() => resolve(), 2000),
                );
            }).as('uploadRequest');

        // # Create bookmark
        createFileBookmark({file, save: false});

        // # Cancel upload
        cy.get('a.file-preview__remove').click();

        // * Verify empty preview container
        cy.get('.file-preview__container.empty');

        // * Verify upload cancelled
        cy.wait('@uploadRequest').its('state').should('eq', 'Errored');

        // * Verify cannot save
        cy.findByRole('button', {name: 'Add bookmark'}).should('be.disabled');

        // # Try upload file again
        cy.get('#bookmark-create-file-input-in-modal').attachFile(file);

        // * Verify uploaded
        cy.findByTestId('titleInput').should('have.value', file);
        cy.findByRole('link', {name: `file thumbnail ${file}`});

        // # Save
        editModalCreate();

        // * Verify bookmark created
        cy.findAllByRole('link', {name: file});
    });

    it('create file bookmark, with emoji and custom title', () => {
        // # Create bookmark
        const {file, displayName, emojiName} = createFileBookmark({file: 'm4a-audio-file.m4a', displayName: 'custom displayname small-image', emojiName: 'smile'});

        // * Verify emoji and custom display name
        cy.findAllByRole('link', {name: `:${emojiName}: ${displayName}`}).click();

        // * Verify preview opened
        cy.get('.file-preview-modal').findByRole('heading', {name: file});
        cy.get('.icon-close').click();
    });

    it('edit link bookmark', () => {
        // # Create link
        const {displayName} = createLinkBookmark();

        const nextLink = 'google.com/q=test001';
        const realNextLink = `http://${nextLink}`;
        const nextDisplayName = 'Next custom display name';
        const nextEmojiName = 'handshake';

        // # Open edit
        openEditModal(displayName);

        // # Change link, displayname, emoji
        editTextInput('linkInput', nextLink);
        editTextInput('titleInput', nextDisplayName);
        selectEmoji(nextEmojiName);

        // # Save
        editModalSave();

        // * Verify changes
        cy.findAllByRole('link', {name: `:${nextEmojiName}: ${nextDisplayName}`}).should('have.attr', 'href', realNextLink);
    });

    it('delete bookmark', () => {
        const {displayName} = createLinkBookmark();

        // * Verify bookmark exists
        cy.findByRole('link', {name: displayName});

        // # Start delete bookmark flow
        openDotMenu(displayName);
        cy.findByRole('menuitem', {name: 'Delete'}).click();
        cy.findByRole('dialog', {name: 'Delete bookmark'}).within(() => {
            // * Verify delete dialog contents
            cy.findByRole('heading', {name: 'Delete bookmark'});
            cy.contains(`Are you sure you want to delete the bookmark ${displayName}?`);

            // # Delete bookmark
            cy.findByRole('button', {name: 'Yes, delete'}).click();
        });

        // * Verify bookmark deleted
        cy.findByRole('link', {name: displayName}).should('not.exist');
    });
});

function promptAddLink() {
    cy.get('#channelBookmarksPlusMenuButton').click();
    cy.get('#channelBookmarksAddLink').click();
}

function openEditModal(name: string) {
    openDotMenu(name);
    cy.findByRole('menuitem', {name: 'Edit'}).click();
}

function openDotMenu(name: string) {
    cy.findByTestId('channel-bookmarks-container').within(() => {
        // # open menu
        cy.findByRole('link', {name}).scrollIntoView().focus().
            parent('div').find('button').click();
    });
}

function editModalSave() {
    cy.findByRole('button', {name: 'Save bookmark'}).click();
}

function editModalCreate() {
    cy.findByRole('button', {name: 'Add bookmark'}).click();
}

function createLinkBookmark({
    link = `google.com/?q=test${getRandomId(7)}`,
    displayName = '',
    emojiName = '', // e.g. smile
    save = true,
} = {}) {
    const realLink = `http://${link}`;

    // # Add link
    promptAddLink();

    // # Enter link
    editTextInput('linkInput', link);

    if (displayName) {
        // # Enter displayname
        editTextInput('titleInput', displayName);
    }

    if (emojiName) {
        // # Select emoji
        selectEmoji(emojiName);
    }

    if (save) {
        // # Save
        editModalCreate();
    }

    return {link, realLink, displayName: displayName || link, emojiName};
}

function createFileBookmark({
    file = 'small-image.png',
    displayName = '',
    emojiName = '', // e.g. smile
    save = true,
} = {}) {
    cy.get('#bookmark-create-file-input').attachFile(file);

    if (displayName) {
        // # Enter displayname
        cy.findByTestId('titleInput').should('have.value', file);
        editTextInput('titleInput', displayName);
    }

    if (emojiName) {
        // # Select emoji
        selectEmoji(emojiName);
    }

    if (save) {
        // # Save
        cy.findByRole('button', {name: 'Add bookmark'}).click();
    }

    return {file, displayName, emojiName};
}

function editTextInput(testid: string, nextValue: string) {
    cy.findByTestId(testid).
        focus().
        clear().
        wait(TIMEOUTS.HALF_SEC).
        type(nextValue).
        wait(TIMEOUTS.HALF_SEC).
        should('have.value', nextValue);
}

function selectEmoji(emojiName: string) {
    cy.findByRole('button', {name: 'select an emoji'}).click();
    cy.focused().type(`${emojiName}{downArrow}{enter}`);
}
