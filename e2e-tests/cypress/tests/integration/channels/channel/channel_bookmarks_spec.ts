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

import * as TIMEOUTS from '@/fixtures/timeouts';
import {getRandomId, stubClipboard} from '@/utils';

describe('Channel Bookmarks', () => {
    let testTeam: Team;


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

            // # Open the bookmark — may be in overflow menu
            cy.findByTestId('channel-bookmarks-container').then(($container) => {
                const barLink = findVisibleBarLink($container, file);
                if (barLink.length) {
                    // Bookmark visible in bar — click directly
                    cy.wrap(barLink).first().find('.file-icon.image').should('exist');
                    cy.wrap(barLink).first().click();
                } else {
                    // Bookmark is in overflow — open menu and click
                    cy.get('#channelBookmarksBarMenuButton').click();
                    cy.findByRole('menuitem', {name: file}).click();
                }
            });

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

            // * Verify bookmark created — may be in bar or overflow
            findBookmarkAnywhere(file);
        });

        it('create file bookmark, with emoji and custom title', () => {
        // # Create bookmark
            const {file, displayName} = createFileBookmark({file: 'm4a-audio-file.m4a', displayName: 'custom displayname small-image', emojiName: 'smiling_face_with_3_hearts'});

            // * Verify emoji and custom display name, then open preview — may be in bar or overflow
            cy.findByTestId('channel-bookmarks-container').then(($container) => {
                const barLink = findVisibleBarLink($container, displayName);
                if (barLink.length) {
                    cy.wrap(barLink).first().click();
                } else {
                    cy.get('#channelBookmarksBarMenuButton').click();
                    cy.contains('[role="menuitem"]', displayName).click();
                }
            });

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
            cy.get('.modal').should('not.exist');

            // * Verify changes — bookmark may be in bar or overflow
            cy.findByTestId('channel-bookmarks-container').then(($container) => {
                const barLink = findVisibleBarLink($container, nextDisplayName);
                if (barLink.length) {
                    cy.wrap(barLink).first().should('have.attr', 'href', realNextLink);
                } else {
                    cy.get('#channelBookmarksBarMenuButton').click();
                    cy.contains('[role="menuitem"]', nextDisplayName).should('exist');
                    cy.get('body').type('{esc}');

                    // * Verify URL was saved via API (overflow items don't render href)
                    cy.makeClient().then(async (client) => {
                        const bookmarks = await client.getChannelBookmarks(publicChannel.id);
                        const edited = bookmarks.find((b) => b.display_name === nextDisplayName);
                        expect(edited?.link_url).to.eq(realNextLink);
                    });
                }
            });
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
            cy.get('.modal').should('not.exist');

            // * Verify changes — bookmark may be in bar or overflow
            cy.findByTestId('channel-bookmarks-container').then(($container) => {
                const barLink = findVisibleBarLink($container, nextDisplayName);
                if (barLink.length) {
                    cy.wrap(barLink).first().should('have.attr', 'href', realLink);
                } else {
                    cy.get('#channelBookmarksBarMenuButton').click();
                    cy.contains('[role="menuitem"]', nextDisplayName).should('exist');
                    cy.get('body').type('{esc}');

                    // * Verify URL unchanged via API (overflow items don't render href)
                    cy.makeClient().then(async (client) => {
                        const bookmarks = await client.getChannelBookmarks(publicChannel.id);
                        const edited = bookmarks.find((b) => b.display_name === nextDisplayName);
                        expect(edited?.link_url).to.eq(realLink);
                    });
                }
            });
        });

        it('delete bookmark', () => {
            const {displayName} = createLinkBookmark();

            // * Verify bookmark exists (bar or overflow)
            findBookmarkAnywhere(displayName);

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

            // * Verify bookmark deleted (not in bar)
            cy.findByTestId('channel-bookmarks-container').then(($container) => {
                const barLink = findVisibleBarLink($container, displayName);
                expect(barLink.length).to.eq(0);
            });

            // * Verify bookmark absent from server (covers both bar and overflow)
            cy.makeClient().then(async (client) => {
                const bookmarks = await client.getChannelBookmarks(publicChannel.id);
                const found = bookmarks.find((b) => b.display_name === displayName);
                expect(found).to.be.undefined;
            });
        });

        it('reorder bookmark', () => {
            // Use a fresh channel to avoid overflow — need items visible in bar
            cy.apiCreateChannel(testTeam.id, `reorder-${getRandomId(4)}`, 'reorder test', 'O').then((result) => {
                cy.visit(`/${testTeam.name}/channels/${result.channel.name}`);

                const {displayName: name1} = createLinkBookmark({displayName: 'Reorder Item A', fromChannelMenu: true});
                const {displayName: name2} = createLinkBookmark({displayName: 'Reorder Item B'});

                cy.findByTestId('channel-bookmarks-container').within(() => {
                    cy.findAllByRole('link').should('have.length', 2).as('bookmarks');
                    cy.get('@bookmarks').eq(0).should('contain', name1);
                    cy.get('@bookmarks').eq(1).should('contain', name2);

                    // # Keyboard reorder: Space to select, ArrowRight to move, Space to confirm
                    cy.findByRole('link', {name: name1}).focus().type(' ');
                    cy.wait(TIMEOUTS.HALF_SEC);
                    cy.findByRole('link', {name: name1}).type('{rightarrow}');
                    cy.wait(TIMEOUTS.HALF_SEC);

                    // * Verify focus follows the moved item
                    cy.focused().should('contain', name1);

                    cy.findByRole('link', {name: name1}).type(' ');
                });

                cy.wait(TIMEOUTS.ONE_SEC);

                // * Verify order swapped
                cy.findByTestId('channel-bookmarks-container').within(() => {
                    cy.findAllByRole('link').should('have.length', 2).as('after');
                    cy.get('@after').eq(0).should('contain', name2);
                    cy.get('@after').eq(1).should('contain', name1);
                });

                // # Return to original channel for subsequent tests
                cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);
            });
        });

        it('reorder is disabled when only one bookmark exists', () => {
            // # Use a fresh channel with exactly one bookmark
            cy.apiCreateChannel(testTeam.id, `single-${getRandomId(4)}`, 'single bookmark', 'O').then((result) => {
                cy.visit(`/${testTeam.name}/channels/${result.channel.name}`);

                const {displayName} = createLinkBookmark({displayName: 'Solo Bookmark', fromChannelMenu: true});

                // # Press Space on the only bookmark
                cy.findByTestId('channel-bookmarks-container').findByRole('link', {name: displayName}).focus().
                    trigger('keydown', {key: ' ', code: 'Space', bubbles: true});

                cy.wait(TIMEOUTS.HALF_SEC);

                // * Reorder visual state did not engage (no 3px reorder outline)
                cy.findByTestId('channel-bookmarks-container').
                    find('[data-bookmark-id] > div').first().
                    should('not.have.css', 'outline-width', '3px');

                // * Bookmark count and identity unchanged
                cy.findByTestId('channel-bookmarks-container').findAllByRole('link').
                    should('have.length', 1).first().should('contain', displayName);

                // # Return to original channel for subsequent tests
                cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);
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
            // # Switch to non-admin user and reload to get fresh permissions
            cy.apiLogin(user1);
            cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);
            cy.wait(TIMEOUTS.ONE_SEC);

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
            // * Verify create bookmark submenu not in channel menu
            cy.uiOpenChannelMenu();
            cy.findByRole('menuitem', {name: 'Bookmarks Bar'}).should('not.exist');
            cy.get('body').type('{esc}');

            // * Verify add actions not in bookmarks bar menu (if button exists due to overflow items)
            cy.get('body').then(($body) => {
                if ($body.find('#channelBookmarksBarMenuButton').length) {
                    cy.get('#channelBookmarksBarMenuButton').click();
                    cy.get('#channelBookmarksAddLink').should('not.exist');
                    cy.get('#channelBookmarksAttachFile').should('not.exist');
                    cy.get('body').type('{esc}');
                }
            });
        };
    });

    describe('overflow and reorder', () => {
        let overflowChannel: Channel;
        const OVERFLOW_COUNT = 15;

        before(() => {
            cy.apiAdminLogin();
            cy.apiCreateChannel(testTeam.id, `overflow-${getRandomId(4)}`, 'overflow test', 'O').then((result) => {
                overflowChannel = result.channel;

                cy.makeClient().then(async (client) => {
                    for (let i = 1; i <= OVERFLOW_COUNT; i++) {
                        // eslint-disable-next-line no-await-in-loop
                        await client.createChannelBookmark(overflowChannel.id, {
                            type: 'link',
                            display_name: `OvBm ${String(i).padStart(2, '0')}`,
                            link_url: `https://example.com/bm-${i}`,
                        }, '');
                    }
                });

                cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
                cy.findByTestId('channel-bookmarks-container').should('be.visible');
            });
        });

        // Dismiss any stale menu/backdrop from previous test
        beforeEach(() => {
            cy.get('body').then(($body) => {
                if ($body.find('#backdropForMenuComponent').length) {
                    cy.get('#backdropForMenuComponent').click({force: true});
                    cy.wait(TIMEOUTS.HALF_SEC);
                }
            });
        });

        it('shows overflow count badge', () => {
            // * Verify overflow button is visible with a positive count
            cy.get('#channelBookmarksBarMenuButton').should('be.visible');
            cy.get('#channelBookmarksBarMenuButton').invoke('text').then((text) => {
                const count = parseInt(text.replace(/\D/g, ''), 10);
                expect(count).to.be.greaterThan(0);
            });
        });

        it('opens overflow menu and shows items', () => {
            cy.get('#channelBookmarksBarMenuButton').click();

            // * Verify overflow items appear as menuitems
            cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                cy.get('[data-bookmark-id]').should('have.length.gte', 2);
            });

            // * Verify add actions below separator — scroll if needed
            cy.get('#channelBookmarksAddLink').scrollIntoView().should('exist');
            cy.get('#channelBookmarksAttachFile').should('exist');

            dismissMenu();
        });

        it('keyboard reorder within overflow', () => {
            // # Open overflow menu and get the first two item names
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').eq(0).invoke('text').then((firstText) => {
                const firstName = firstText.trim();

                cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').eq(1).invoke('text').then((secondText) => {
                    const secondName = secondText.trim();

                    // # Select first item with Space, move down, confirm with Space
                    cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                        cy.contains('[data-bookmark-id]', firstName).focus()
                            .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                    });
                    cy.wait(TIMEOUTS.HALF_SEC);

                    cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                        cy.contains('[data-bookmark-id]', firstName)
                            .trigger('keydown', {key: 'ArrowDown', code: 'ArrowDown', bubbles: true});
                    });
                    cy.wait(TIMEOUTS.HALF_SEC);

                    cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                        cy.contains('[data-bookmark-id]', firstName)
                            .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                    });
                    cy.wait(TIMEOUTS.ONE_SEC);

                    // * Verify overflow menu stays open after confirm
                    cy.get('#channelBookmarksBarMenuDropdown').should('exist');

                    // * Verify items swapped — first item should now be what was second
                    cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').eq(0).should('contain', secondName);
                    cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').eq(1).should('contain', firstName);
                    dismissMenu();
                });
            });
        });

        it('keyboard reorder: Escape cancels', () => {
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').eq(0).invoke('text').then((firstText) => {
                const firstName = firstText.trim();

                // # Select, move, then Escape to cancel
                cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                    cy.contains('[data-bookmark-id]', firstName).focus()
                        .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                });
                cy.wait(TIMEOUTS.HALF_SEC);

                cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                    cy.contains('[data-bookmark-id]', firstName)
                        .trigger('keydown', {key: 'ArrowDown', code: 'ArrowDown', bubbles: true});
                });
                cy.wait(TIMEOUTS.HALF_SEC);

                cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                    cy.contains('[data-bookmark-id]', firstName)
                        .trigger('keydown', {key: 'Escape', code: 'Escape', bubbles: true});
                });
                cy.wait(TIMEOUTS.ONE_SEC);

                // Close menu and backdrop before reopening to verify
                dismissMenu();

                // * Verify original order restored — first item unchanged
                cy.get('#channelBookmarksBarMenuButton').click();
                cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').eq(0).should('contain', firstName);
                dismissMenu();
            });
        });

        it('edit from overflow dot menu', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            const newName = `Edited OvBm ${getRandomId(4)}`;

            // # Open overflow menu
            cy.get('#channelBookmarksBarMenuButton').click();

            // # Hover first overflow item to reveal dot menu, then click it
            clickOverflowDotMenu(cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first());
            cy.findByRole('menuitem', {name: 'Edit'}).click();

            // # Change display name
            editTextInput('titleInput', newName);
            editModalSave();
            cy.get('.modal').should('not.exist');

            // * Verify the name changed — may be in bar or overflow
            findBookmarkAnywhere(newName);
        });

        it('copy link from overflow dot menu', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Stub clipboard to intercept the copy
            stubClipboard().as('clipboard');

            // # Open overflow menu and get the first item's link URL
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first().invoke('attr', 'data-bookmark-id').then((bookmarkId) => {
                // # Click first overflow item's dot menu
                clickOverflowDotMenu(cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first());

                // # Click "Copy link"
                cy.findByRole('menuitem', {name: 'Copy link'}).should('exist').click();

                // * Verify dot menu closed
                cy.get('#channelBookmarksDotMenuDropdown').should('not.exist');

                // * Verify clipboard contains the bookmark URL
                cy.makeClient().then(async (client) => {
                    const bookmarks = await client.getChannelBookmarks(overflowChannel.id);
                    const bookmark = bookmarks.find((b) => b.id === bookmarkId);
                    cy.get('@clipboard').its('contents').should('eq', bookmark?.link_url);
                });
            });
        });

        it('delete from overflow dot menu', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Open overflow menu and get first item name
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first().invoke('text').then((itemText) => {
                const itemName = itemText.trim();

                // # Hover first overflow item to reveal dot menu, then click it
                clickOverflowDotMenu(cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first());
                cy.findByRole('menuitem', {name: 'Delete'}).click();
                cy.findByRole('dialog', {name: 'Delete bookmark'}).within(() => {
                    cy.findByRole('button', {name: 'Yes, delete'}).click();
                });
                cy.get('.modal').should('not.exist');

                // * Verify item is gone — reopen menu and check
                cy.get('#channelBookmarksBarMenuButton').click();
                cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                    cy.contains('[data-bookmark-id]', itemName).should('not.exist');
                });
                dismissMenu();
            });
        });

        it('overflow recalculates on viewport resize', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Record initial overflow count
            cy.get('#channelBookmarksBarMenuButton').invoke('text').then((text) => {
                const initialCount = parseInt(text.replace(/\D/g, ''), 10);

                // # Shrink viewport to push more items into overflow
                cy.viewport(800, 660);
                cy.wait(TIMEOUTS.ONE_SEC);

                // * Verify overflow count increased
                cy.get('#channelBookmarksBarMenuButton').invoke('text').then((newText) => {
                    const newCount = parseInt(newText.replace(/\D/g, ''), 10);
                    expect(newCount).to.be.greaterThan(initialCount);
                });

                // # Restore viewport
                cy.viewport(1300, 660);
            });
        });

        it('ArrowDown on open menu panel focuses first overflow item', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Open overflow menu — MUI focuses the Paper (menu panel), not the button
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown').should('be.visible');

            // # Press ArrowDown on the menu panel (where focus rests after open)
            cy.get('#channelBookmarksBarMenuDropdown').trigger('keydown', {key: 'ArrowDown', code: 'ArrowDown'});

            // * Verify first overflow item has focus
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first().then(($el) => {
                cy.focused().closest('[data-bookmark-id]').should('have.attr', 'data-bookmark-id', $el.attr('data-bookmark-id'));
            });

            dismissMenu();
        });

        it('keyboard reorder: ArrowRight moves last bar item into overflow', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Capture the last visible bar item's name (scoped to bar to exclude overflow)
            cy.findByTestId('channel-bookmarks-container').findAllByRole('link').last().invoke('text').then((text) => {
                const lastName = text.trim();

                // # Start reorder, move right to cross into overflow, confirm
                cy.findByRole('link', {name: lastName}).focus()
                    .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                cy.focused().trigger('keydown', {key: 'ArrowRight', code: 'ArrowRight', bubbles: true});
                cy.focused().trigger('keydown', {key: ' ', code: 'Space', bubbles: true});

                // * Verify via API the item moved past its original last-visible position
                cy.makeClient().then(async (client) => {
                    const bookmarks = await client.getChannelBookmarks(overflowChannel.id);
                    const movedIndex = bookmarks.findIndex((b) => b.display_name === lastName);
                    expect(movedIndex).to.be.greaterThan(0);
                });

                // * Verify DOM: item is present in the open overflow menu (menu stays
                //   open after confirm when item ends in overflow)
                cy.get('#channelBookmarksBarMenuDropdown')
                    .should('be.visible')
                    .contains(lastName)
                    .should('be.visible');

                // # Close menu to remove MUI backdrop covering the bar
                dismissMenu();
                cy.get('#channelBookmarksBarMenuDropdown').should('not.exist');

                // * Verify DOM: item is no longer rendered in the visible bar
                cy.findByTestId('channel-bookmarks-container').findAllByRole('link').then(($links) => {
                    const barNames = [...$links].map((el) => el.textContent?.trim());
                    expect(barNames).to.not.include(lastName);
                });
            });
        });

        it('keyboard reorder: ArrowUp moves first overflow item into bar', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Open overflow and start reorder on first item, move up to bar
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first().invoke('text').then((text) => {
                const firstOverflowName = text.trim();

                cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                    cy.contains('[data-bookmark-id]', firstOverflowName).focus()
                        .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                    cy.contains('[data-bookmark-id]', firstOverflowName)
                        .trigger('keydown', {key: 'ArrowUp', code: 'ArrowUp', bubbles: true});
                });

                // * Verify overflow menu closed (transitioned to bar)
                cy.get('#channelBookmarksBarMenuDropdown').should('not.exist');

                // # Confirm placement on bar
                cy.focused().trigger('keydown', {key: ' ', code: 'Space', bubbles: true});

                // * Verify the moved item is now visible in the bar
                cy.findByTestId('channel-bookmarks-container').within(() => {
                    cy.findByRole('link', {name: firstOverflowName}).should('exist');
                });
            });
        });

        it('ArrowRight opens dot menu from overflow item', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Open overflow and focus first item
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first().focus();

            // # ArrowRight to open dot menu
            cy.focused().trigger('keydown', {key: 'ArrowRight', code: 'ArrowRight', bubbles: true});

            // * Verify dot menu dropdown opened
            cy.get('#channelBookmarksDotMenuDropdown').should('be.visible');

            // # ArrowLeft to close and return to item
            cy.get('#channelBookmarksDotMenuDropdown').trigger('keydown', {key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true});

            // * Verify dot menu closed
            cy.get('#channelBookmarksDotMenuDropdown').should('not.exist');
            dismissMenu();
        });

        it('keyboard reorder Space confirm does not activate link', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            const initialUrl = `/${testTeam.name}/channels/${overflowChannel.name}`;

            // # Open overflow menu
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first().invoke('text').then((text) => {
                const firstName = text.trim();

                // # Space to select, ArrowDown to move, Space to confirm
                cy.get('#channelBookmarksBarMenuDropdown').within(() => {
                    cy.contains('[data-bookmark-id]', firstName).focus()
                        .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                    cy.contains('[data-bookmark-id]', firstName)
                        .trigger('keydown', {key: 'ArrowDown', code: 'ArrowDown', bubbles: true});
                    cy.contains('[data-bookmark-id]', firstName)
                        .trigger('keydown', {key: ' ', code: 'Space', bubbles: true});
                });

                // * Verify we did NOT navigate (URL unchanged, no new tab)
                cy.url().should('include', initialUrl);
            });

            dismissMenu();
        });

        it('overflow menu button aria-label reflects count', () => {
            // # Overflow channel — button should mention count
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');
            cy.get('#channelBookmarksBarMenuButton').should(($btn) => {
                const label = $btn.attr('aria-label') ?? '';
                expect(label).to.match(/more bookmark/i);
            });
        });

        it('overflow recalculates when a bookmark is renamed to a much longer name', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Capture initial overflow count
            cy.get('#channelBookmarksBarMenuButton').invoke('text').then((text) => {
                const initialCount = parseInt(text.replace(/\D/g, ''), 10);

                // # Rename the first bookmark via API — edit UI is tested separately.
                // This test verifies overflow recalculation behavior, not the rename flow.
                cy.makeClient().then(async (client) => {
                    const bookmarks = await client.getChannelBookmarks(overflowChannel.id);
                    await client.updateChannelBookmark(overflowChannel.id, bookmarks[0].id, {
                        display_name: 'A very very very very very very very long renamed bookmark',
                    }, '');
                });

                // * Verify overflow count increased (item got wider → more items pushed into overflow)
                cy.get('#channelBookmarksBarMenuButton').should(($btn) => {
                    const newCount = parseInt($btn.text().replace(/\D/g, ''), 10);
                    expect(newCount).to.be.greaterThan(initialCount);
                });
            });
        });

        it('channel switch preserves overflow detection', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');
            cy.get('#channelBookmarksBarMenuButton').should('be.visible');

            // # Switch to publicChannel (few/no bookmarks — overflow button should not show count)
            cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);

            // # Back to overflow channel — detection still works
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');
            cy.get('#channelBookmarksBarMenuButton').should(($btn) => {
                const count = parseInt($btn.text().replace(/\D/g, ''), 10);
                expect(count).to.be.greaterThan(0);
            });
        });

        it('dot menu "Open" action fires exactly once', () => {
            cy.visit(`/${testTeam.name}/channels/${overflowChannel.name}`);
            cy.findByTestId('channel-bookmarks-container').should('be.visible');

            // # Stub window.open so we can count external-tab opens from "Open" action
            cy.window().then((win) => {
                cy.stub(win, 'open').as('windowOpen');
            });

            // # Open overflow, click dot menu on first item
            cy.get('#channelBookmarksBarMenuButton').click();
            clickOverflowDotMenu(cy.get('#channelBookmarksBarMenuDropdown [data-bookmark-id]').first());

            // # Press Enter on "Open" menu item — the keydown + ButtonBase synthetic click
            // used to fire onClick twice. handledRef guard ensures single dispatch.
            cy.findByRole('menuitem', {name: 'Open'}).should('exist').focus()
                .trigger('keydown', {key: 'Enter', code: 'Enter', bubbles: true});

            // * Verify window.open called exactly once (no Menu.Item double-fire)
            cy.get('@windowOpen').should('have.been.calledOnce');
        });
    });

    describe('limits enforced', () => {
        it('max bookmarks', () => {
            // # Create links, fill to max
            makeBookmarks(publicChannel);

            cy.visit(`/${testTeam.name}/channels/${publicChannel.name}`);

            // * Verify overflow menu button is still enabled (shows overflow items)
            cy.get('#channelBookmarksBarMenuButton').should('not.be.disabled');

            // # Open the overflow/plus menu
            cy.get('#channelBookmarksBarMenuButton').click();

            // * Verify add actions are disabled when at limit
            cy.get('#channelBookmarksAddLink').should('have.attr', 'aria-disabled', 'true');
            cy.get('#channelBookmarksAttachFile').should('have.attr', 'aria-disabled', 'true');
        });
    });

    function makeBookmarks(channel: Channel, n?: number) {
        cy.makeClient().then(async (client) => {
            const nToMake = n ?? BOOKMARK_LIMIT - (await client.getChannelBookmarks(channel.id))?.length;

            await Promise.allSettled(Array(nToMake).fill(0).map(() => {
                return client.createChannelBookmark(channel.id, {
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

        cy.findByRole('menuitem', {name: 'Bookmarks Bar'}).trigger('mouseover');
        cy.findByRole('menuitem', {name: 'Add a link'}).click();
    } else {
        cy.get('#channelBookmarksBarMenuButton').click();
        cy.get('#channelBookmarksAddLink').click();
    }
}

function promptAddFile(fromChannelMenu = false) {
    if (fromChannelMenu) {
        cy.uiOpenChannelMenu();

        cy.findByRole('menuitem', {name: 'Bookmarks Bar'}).trigger('mouseover');
        cy.findByRole('menuitem', {name: 'Attach a file'}).click();
    } else {
        cy.get('#channelBookmarksBarMenuButton').click();
        cy.get('#channelBookmarksAttachFile').click();
    }
}

function openEditModal(name: string) {
    openDotMenu(name);
    cy.findByRole('menuitem', {name: 'Edit'}).click();
}

/**
 * Opens the dot menu for a bookmark by name.
 * Handles both bar items and overflow items.
 */
function openDotMenu(name: string) {
    // Wait for any stale modal to close (e.g. file preview from previous test)
    cy.get('.modal').should('not.exist');

    cy.findByTestId('channel-bookmarks-container').then(($container) => {
        const barLink = findVisibleBarLink($container, name);
        if (barLink.length) {
            // Bar item — dot menu hidden via opacity:0 until :hover (CSS),
            // force:true bypasses since Cypress can't trigger :hover.
            cy.wrap(barLink).first().closest('[data-bookmark-id]').scrollIntoView();
            cy.wrap(barLink).first().closest('[data-bookmark-id]').
                find('button[aria-label="Bookmark menu"]').click({force: true});
        } else {
            // Overflow item — open overflow menu, find the item's dot menu
            cy.get('#channelBookmarksBarMenuButton').click();
            clickOverflowDotMenu(
                cy.get('#channelBookmarksBarMenuDropdown').contains('[role="menuitem"]', name),
            );
        }
    });
}

/**
 * Finds a bookmark anywhere — bar or overflow — and asserts it exists.
 */
function findBookmarkAnywhere(name: string) {
    cy.findByTestId('channel-bookmarks-container').then(($container) => {
        const barLink = findVisibleBarLink($container, name);
        if (barLink.length) {
            cy.wrap(barLink).first().should('be.visible');
        } else {
            cy.get('#channelBookmarksBarMenuButton').click();
            cy.contains('[role="menuitem"]', name).should('exist');
            cy.get('body').type('{esc}');
        }
    });
}

function editModalSave() {
    cy.findByRole('button', {name: 'Save bookmark'}).click();
}

function editModalCreate() {
    cy.findByRole('button', {name: 'Add bookmark'}).click();
    cy.get('.modal').should('not.exist');
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
        cy.get('.modal').should('not.exist');
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
    cy.findByRole('dialog').within(() => {
        cy.findByRole('button', {name: 'select an emoji'}).click();
    });
    cy.focused().type(`${emojiName}{downArrow}{enter}`);
}

/**
 * Dismisses any open overflow/bookmark menu by clicking the backdrop.
 * Waits for the menu to fully close before proceeding.
 */
function dismissMenu() {
    cy.get('body').then(($body) => {
        if ($body.find('#channelBookmarksBarMenuDropdown').length) {
            cy.get('#backdropForMenuComponent').click({force: true});
            cy.wait(TIMEOUTS.HALF_SEC);
        }
    });
}

/**
 * Clicks the dot menu button on an overflow bookmark item.
 * The button is hidden via CSS opacity:0 until :hover, which
 * can't be triggered by Cypress synthetic events in headless
 * mode. force:true bypasses the visibility check.
 */
function clickOverflowDotMenu(item: Cypress.Chainable) {
    item.scrollIntoView()
        .find('.channelBookmarksDotMenuButton--overflow').click({force: true});
}

/**
 * Finds visible bar links by name, excluding hidden measurement items.
 * Hidden items (used for overflow measurement) have `visibility: hidden`
 * on an ancestor, which is inherited by the anchor element.
 */
function findVisibleBarLink($container: JQuery, name: string): JQuery {
    return $container.find(`a:contains("${name}")`).filter(function() {
        return Cypress.$(this).css('visibility') !== 'hidden';
    });
}
