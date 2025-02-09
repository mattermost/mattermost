// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel @channel_bookmarks
// node run_tests.js --group='@channel'

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Channel Bookmarks', () => {
    const SpaceKeyCode = 32;
    const RightArrowKeyCode = 39;

    let testTeam: Team;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let user1: UserProfile;
    let admin: UserProfile;
    let publicChannel: Channel;
    let privateChannel: Channel;
    let channelToArchive: Channel;

    const BOOKMARK_LIMIT = 50;

    before(() => {
        cy.apiRequireLicense();

        cy.apiGetMe().then(({user: adminUser}) => {
            admin = adminUser;

            cy.apiInitSetup().then(({team, user, channel}) => {
                testTeam = team;
                user1 = user;
                publicChannel = channel;

                cy.apiCreateChannel(testTeam.id, 'private-channel', 'private channel', 'P').then((result) => {
                    privateChannel = result.channel;
                    cy.apiAddUserToChannel(privateChannel.id, user1.id);
                });

                cy.apiCreateChannel(testTeam.id, 'public-channel-archive', 'public channel archive', 'O').then((result) => {
                    channelToArchive = result.channel;
                    cy.apiAddUserToChannel(channelToArchive.id, user1.id);
                });

                cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);
            });
        });
    });

    describe('functionality', () => {
        it('bookmarks bar hidden when empty', () => {
        // # Go to channel menu
            cy.uiGetChannelInfoButton();
            cy.makeClient().then(async (client) => {
                const bookmarks = await client.getChannelBookmarks(publicChannel.id);
                cy.wrap(bookmarks.length).should('eq', 0);
            });

            // * Verify bookmarks bar not present
            cy.findByTestId('channel-bookmarks-container').should('not.exist');
        });

        it('create link bookmark from channel menu', () => {
        // # Create link
            const {link, realLink} = createLinkBookmark({fromChannelMenu: true});

            // * Verify bar now visible
            cy.findByTestId('channel-bookmarks-container').within(() => {
            // * Verify href
                cy.findByRole('link', {name: link}).should('have.attr', 'href', realLink);
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
            const {realLink, displayName, emojiName} = createLinkBookmark({displayName: 'custom display name', emojiName: 'smiling_face_with_3_hearts'});

            cy.findByTestId('channel-bookmarks-container').within(() => {
            // * Verify emoji, displayname, and href
                cy.findByRole('link', {name: `:${emojiName}: ${displayName}`}).should('have.attr', 'href', realLink);
            });
        });

        it('create file bookmark from channel menu', () => {
        // # Create bookmark
            const {file} = createFileBookmark({file: 'mp4-video-file.mp4', fromChannelMenu: true});

            // * Verify uploaded
            cy.findByRole('link', {name: file});
        });

        it('create file bookmark, and open preview', () => {
        // # Create bookmark
            const {file} = createFileBookmark({file: 'small-image.png'});

            // * Verify preview icon
            cy.findByRole('link', {name: file}).as('link').find('.file-icon.image');

            // # Open preview
            cy.get('@link').click();

            // * Verify preview opened
            cy.get('.file-preview-modal').findByRole('heading', {name: file});
            cy.get('.file-preview-modal__file-details-user-name').should('have.text', admin.username);
            cy.get('.file-preview-modal__channel').should('have.text', `Shared in ~${publicChannel.display_name}`);
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
            cy.findByRole('link', {name: file});
        });

        it('create file bookmark, with emoji and custom title', () => {
        // # Create bookmark
            const {file, displayName, emojiName} = createFileBookmark({file: 'm4a-audio-file.m4a', displayName: 'custom displayname small-image', emojiName: 'smiling_face_with_3_hearts'});

            // * Verify emoji and custom display name
            cy.findByRole('link', {name: `:${emojiName}: ${displayName}`}).click();

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

        it('edit link bookmark, only display name and emoji', () => {
        // # Create link
            const {displayName, realLink} = createLinkBookmark();

            const nextDisplayName = 'Next custom display name 2';
            const nextEmojiName = 'handshake';

            // # Open edit
            openEditModal(displayName);

            // # Change link, displayname, emoji
            editTextInput('titleInput', nextDisplayName);
            selectEmoji(nextEmojiName);

            // # Save
            editModalSave();

            // * Verify changes
            cy.findAllByRole('link', {name: `:${nextEmojiName}: ${nextDisplayName}`}).should('have.attr', 'href', realLink);
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

        it('reorder bookmark', () => {
            const {displayName: name1} = createFileBookmark({file: 'm4a-audio-file.m4a', displayName: 'custom displayname 1'});
            const {displayName: name2} = createFileBookmark({file: 'm4a-audio-file.m4a', displayName: 'custom displayname 2'});

            // # Start reorder bookmark flow
            cy.findByTestId('channel-bookmarks-container').within(() => {
                cy.findAllByRole('link').should('be.visible').as('bookmarks');
                cy.get('@bookmarks').eq(-1).scrollIntoView();
                cy.get('@bookmarks').eq(-2).should('contain', name1);
                cy.get('@bookmarks').eq(-1).should('contain', name2);

                // # Perform drag using keyboard
                cy.get(`a:contains(${name1})`).
                    trigger('keydown', {keyCode: SpaceKeyCode}).
                    trigger('keydown', {keyCode: RightArrowKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC).
                    trigger('keydown', {keyCode: SpaceKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC);

                // * Verify correct order
                cy.findAllByRole('link').should('be.visible').as('bookmarks-after');
                cy.get('@bookmarks-after').eq(-2).should('contain', name2);
                cy.get('@bookmarks-after').eq(-1).should('contain', name1);
            });
        });
    });

    describe('manage bookmarks - permissions enforcement', () => {
        before(() => {
            // # Prep: disable manage bookmarks for users - public and private channels
            cy.uiResetPermissionsToDefault();
            cy.findByTestId('all_users-public_channel-manage_public_channel_bookmarks-checkbox').click();
            cy.findByTestId('all_users-private_channel-manage_private_channel_bookmarks-checkbox').click();
            cy.uiSaveConfig();
            cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);
        });

        after(() => {
            // # Reset permissions
            cy.apiAdminLogin();
            cy.uiResetPermissionsToDefault();
            cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);
        });

        it('can add bookmark: public channel, admin', () => {
            // # To public channel with bookmark
            createLinkBookmark({fromChannelMenu: true});

            // * Verify admin can create in public channel
            verifyCanCreate();
        });

        it('can add bookmark: private channel, admin', () => {
            // # To private channel with bookmark
            cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);
            createLinkBookmark({fromChannelMenu: true});

            // * Verify admin can create in private channel
            verifyCanCreate();
        });

        it('cannot add bookmark: archived channel', () => {
            // # private channel
            cy.visit(`/${testTeam.name}/channels/${channelToArchive.name}`);
            createLinkBookmark({fromChannelMenu: true});

            cy.apiDeleteChannel(channelToArchive.id);

            // * Verify cannot create in archived channel
            verifyCannotCreate();
        });

        it('cannot add bookmark: private channel, non-admin', () => {
            // # Switch to non-admin user
            cy.apiLogin(user1);

            // # private channel
            cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);

            // * Verify non-admin user cannot create in private channel
            verifyCannotCreate();
        });

        it('cannot add bookmark: public channel, non-admin', () => {
            // # To public channel with bookmark
            cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);

            // * Verify non-admin user cannot create in public channel
            verifyCannotCreate();
        });

        const verifyCanCreate = () => {
            // * Verify can access create UI - bookmarks bar
            promptAddLink();
            cy.uiCloseModal('Add a bookmark');

            // * Verify can access create UI - channel menu
            promptAddLink(true);
            cy.uiCloseModal('Add a bookmark');
        };

        const verifyCannotCreate = () => {
            // * Verify cannot access create UI - channel menu
            cy.uiOpenChannelMenu();
            cy.findByRole('menuitem', {name: 'Bookmarks Bar submenu icon'}).should('not.exist');

            // * Verify cannot access create UI - bookmarks bar
            cy.get('#channelBookmarksPlusMenuButton').should('not.exist');
        };
    });

    describe('limits enforced', () => {
        it('max bookmarks', () => {
            // # Create links, fill to max
            makeBookmarks(publicChannel);

            // * Verify add bookmark button is disabled
            cy.findAllByRole('button', {name: 'Add a bookmark'}).should('be.disabled');

            // * Verify create bookmark submenu in channel menu is not shown
            cy.uiOpenChannelMenu();
            cy.findByRole('menuitem', {name: 'Bookmarks Bar submenu icon'}).should('not.exist');
        });
    });

    function makeBookmarks(channel: Channel, n?: number) {
        cy.makeClient().then(async (client) => {
            const nToMake = n ?? BOOKMARK_LIMIT - (await client.getChannelBookmarks(channel.id))?.length;

            await Promise.allSettled(Array(nToMake).fill(0).map(() => {
                return client.createChannelBookmark(publicChannel.id, {
                    type: 'link',
                    display_name: 'google.com',
                    link_url: `https://google.com/?q=test${getRandomId(7)}`,
                }, '');
            }));
        });
    }
});

function promptAddLink(fromChannelMenu = false) {
    if (fromChannelMenu) {
        cy.uiOpenChannelMenu();

        cy.findByRole('menuitem', {name: 'Bookmarks Bar submenu icon'}).trigger('mouseover');
        cy.findByRole('menuitem', {name: 'Add a link not selected'}).click();
    } else {
        cy.get('#channelBookmarksPlusMenuButton').click();
        cy.get('#channelBookmarksAddLink').click();
    }
}

function promptAddFile(fromChannelMenu = false) {
    if (fromChannelMenu) {
        cy.uiOpenChannelMenu();

        cy.findByRole('menuitem', {name: 'Bookmarks Bar submenu icon'}).trigger('mouseover');
        cy.findByRole('menuitem', {name: 'Attach a file not selected'}).click();
    } else {
        cy.get('#channelBookmarksPlusMenuButton').click();
        cy.get('#channelBookmarksAttachFile').click();
    }
}

function openEditModal(name: string) {
    openDotMenu(name);
    cy.findByRole('menuitem', {name: 'Edit'}).click();
}

function openDotMenu(name: string) {
    cy.findByTestId('channel-bookmarks-container').within(() => {
        // # open menu
        cy.findByRole('link', {name}).scrollIntoView().focus().
            parent('div').findByRole('button', {name: 'Bookmark menu'}).click();
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
    fromChannelMenu = false,
} = {}) {
    const realLink = `http://${link}`;

    // # Add link
    promptAddLink(fromChannelMenu);

    // # Enter link
    editTextInput('linkInput', link);

    cy.wait(TIMEOUTS.HALF_SEC);

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
    fromChannelMenu = false,
} = {}) {
    promptAddFile(fromChannelMenu);
    cy.get('#root-portal #bookmark-create-file-input').attachFile(file);

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

/**
 *
 * @param emojiName Name of emoji to select. Be overly specific
 * e.g `smile` will have overlapping results, but `smiling_face_with_3_hearts` is unique with no overlapping results
 */
function selectEmoji(emojiName: string) {
    cy.findByRole('button', {name: 'select an emoji'}).click();
    cy.focused().type(`${emojiName}{downArrow}{enter}`);
}
