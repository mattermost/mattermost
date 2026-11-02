// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import QuoteSelectionButton from './quote_selection_button';

describe('QuoteSelectionButton', () => {
    const channelId = 'channelid1234567890abcdefg';
    const rootPost = TestHelper.getPostMock({id: 'rootpost1234567890abcdefgh', channel_id: channelId});
    const reply = TestHelper.getPostMock({id: 'replypost1234567890abcdefg', channel_id: channelId, root_id: rootPost.id});

    const teamId = 'teamid1234567890abcdefghij';
    const currentUserId = 'userid1234567890abcdefghij';

    const initialState = {
        entities: {
            channels: {
                channels: {
                    [channelId]: TestHelper.getChannelMock({id: channelId, team_id: teamId}),
                },
                roles: {
                    [channelId]: new Set(['channel_roles']),
                },
            },
            posts: {
                posts: {
                    [rootPost.id]: rootPost,
                    [reply.id]: reply,
                },
            },
            roles: {
                roles: {
                    user_roles: {permissions: [Permissions.CREATE_POST]},
                },
            },
            teams: {
                currentTeamId: teamId,
                teams: {
                    [teamId]: TestHelper.getTeamMock({id: teamId}),
                },
                myMembers: {
                    [teamId]: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
                },
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: TestHelper.getUserMock({id: currentUserId, roles: 'user_roles'}),
                },
            },
        },
    };

    const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;

    beforeAll(() => {
        Range.prototype.getBoundingClientRect = () => new DOMRect(120, 40, 0, 20);
    });

    afterAll(() => {
        Range.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    });

    let posts: HTMLElement;

    beforeEach(() => {
        posts = document.createElement('div');
        posts.innerHTML = `
            <div id="post_${rootPost.id}">
                <div class="post-message__text"><p id="centerText">Diam sapien pellentesque vestibulum</p></div>
            </div>
            <div id="rhsPost_${reply.id}">
                <div class="post-message__text"><p id="rhsText">Nunc, eget dictum adipiscing</p></div>
            </div>
            <p id="outsideText">Channel header</p>
        `;
        document.body.appendChild(posts);
    });

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        posts.remove();
    });

    function selectText(id: string, start: number, end: number) {
        const textNode = document.getElementById(id)!.firstChild!;
        window.getSelection()!.setBaseAndExtent(textNode, start, textNode, end);
        fireEvent.mouseUp(textNode.parentElement!);
    }

    test('should not show the button without a selection', () => {
        renderWithContext(<QuoteSelectionButton/>, initialState);

        expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
    });

    test('should quote text selected in the center channel into the channel message box', async () => {
        const {store} = renderWithContext(<QuoteSelectionButton/>, initialState);

        selectText('centerText', 0, 11);
        await userEvent.click(await screen.findByRole('button', {name: 'Quote selection'}));

        expect(store.getState().views.drafts.pendingQuote).toEqual({
            channelId,
            rootId: '',
            text: 'Diam sapien',
        });
        expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
        expect(window.getSelection()!.isCollapsed).toBe(true);
    });

    test('should quote text selected in the RHS into the thread reply box', async () => {
        const {store} = renderWithContext(<QuoteSelectionButton/>, initialState);

        selectText('rhsText', 6, 18);
        await userEvent.click(await screen.findByRole('button', {name: 'Quote selection'}));

        expect(store.getState().views.drafts.pendingQuote).toEqual({
            channelId,
            rootId: rootPost.id,
            text: 'eget dictum',
        });
    });

    test('should not show the button for text outside of a post', async () => {
        renderWithContext(<QuoteSelectionButton/>, initialState);

        selectText('outsideText', 0, 7);

        // Wait for the deferred selection check to run
        await new Promise((resolve) => setTimeout(resolve));
        expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
    });

    test('should not show the button in an archived channel', async () => {
        renderWithContext(<QuoteSelectionButton/>, mergeObjects(initialState, {
            entities: {
                channels: {
                    channels: {
                        [channelId]: TestHelper.getChannelMock({id: channelId, team_id: teamId, delete_at: 1234}),
                    },
                },
            },
        }));

        selectText('centerText', 0, 11);

        // Wait for the deferred selection check to run
        await new Promise((resolve) => setTimeout(resolve));
        expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
    });

    describe('with the keyboard', () => {
        let previousFocus: HTMLButtonElement;

        beforeEach(() => {
            previousFocus = document.createElement('button');
            previousFocus.textContent = 'Previously focused';
            posts.appendChild(previousFocus);
            previousFocus.focus();
        });

        test('should move the focus to the button with Tab and quote with Enter', async () => {
            const {store} = renderWithContext(<QuoteSelectionButton/>, initialState);

            selectText('centerText', 0, 11);
            const button = await screen.findByRole('button', {name: 'Quote selection'});

            await userEvent.keyboard('{Tab}');
            expect(button).toHaveFocus();

            await userEvent.keyboard('{Enter}');
            expect(store.getState().views.drafts.pendingQuote).toEqual({channelId, rootId: '', text: 'Diam sapien'});
        });

        test.each([
            ['Escape', '{Escape}'],
            ['Tab', '{Tab}'],
            ['Shift+Tab', '{Shift>}{Tab}{/Shift}'],
        ])('should hide the button and return the focus when pressing %s on it', async (_, keys) => {
            renderWithContext(<QuoteSelectionButton/>, initialState);

            selectText('centerText', 0, 11);
            await screen.findByRole('button', {name: 'Quote selection'});
            await userEvent.keyboard('{Tab}');

            await userEvent.keyboard(keys);

            await waitFor(() => {
                expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
            });
            expect(previousFocus).toHaveFocus();
        });

        test('should show the button for a selection made without the mouse', async () => {
            renderWithContext(<QuoteSelectionButton/>, initialState);

            const textNode = document.getElementById('centerText')!.firstChild!;
            window.getSelection()!.setBaseAndExtent(textNode, 0, textNode, 11);
            fireEvent(document, new Event('selectionchange'));

            expect(await screen.findByRole('button', {name: 'Quote selection'})).toBeVisible();
        });
    });

    test('should hide the button when the selection is cleared', async () => {
        renderWithContext(<QuoteSelectionButton/>, initialState);

        selectText('centerText', 0, 11);
        expect(await screen.findByRole('button', {name: 'Quote selection'})).toBeVisible();

        window.getSelection()!.removeAllRanges();
        fireEvent(document, new Event('selectionchange'));

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
        });
    });

    test('should hide the button when pressing Escape', async () => {
        renderWithContext(<QuoteSelectionButton/>, initialState);

        selectText('centerText', 0, 11);
        expect(await screen.findByRole('button', {name: 'Quote selection'})).toBeVisible();

        fireEvent.keyDown(document, {key: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByRole('button', {name: 'Quote selection'})).not.toBeInTheDocument();
        });
    });
});
