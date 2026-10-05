// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as rhsActions from 'actions/views/rhs';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

import ViewChannelMentions from './view_channel_mentions';

const channelId = 'channel_id';
const channelName = 'town-square';

function baseState(rhs: Record<string, unknown>) {
    return {
        entities: {
            channels: {
                currentChannelId: channelId,
                channels: {
                    [channelId]: {id: channelId, name: channelName, type: 'O', display_name: 'Town Square'},
                },
            },
            users: {currentUserId: 'user_id', profiles: {}},
        },
        views: {rhs},
    } as unknown as GlobalState;
}

describe('components/ChannelHeaderMenu/MenuItems/ViewChannelMentions', () => {
    beforeEach(() => {
        jest.spyOn(rhsActions, 'showChannelMentions').mockReturnValue(() => ({data: true}));
        jest.spyOn(rhsActions, 'closeRightHandSide').mockReturnValue(() => ({data: true}));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the component correctly, handles correct click event', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ViewChannelMentions/>
            </WithTestMenuContext>,
        );

        const menuItem = screen.getByRole('menuitem', {name: 'Recent Mentions in this Channel'});
        expect(menuItem).toBeVisible();

        await userEvent.click(menuItem);
        expect(rhsActions.showChannelMentions).toHaveBeenCalledTimes(1);
    });

    test('closes the right-hand side when it already shows mentions for this channel', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ViewChannelMentions/>
            </WithTestMenuContext>,
            baseState({rhsState: RHSStates.MENTION, searchTerms: `@me in:${channelName} `}),
        );

        await userEvent.click(screen.getByRole('menuitem', {name: 'Recent Mentions in this Channel'}));
        expect(rhsActions.closeRightHandSide).toHaveBeenCalledTimes(1);
        expect(rhsActions.showChannelMentions).not.toHaveBeenCalled();
    });

    test('re-scopes when the panel shows mentions for a different channel', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ViewChannelMentions/>
            </WithTestMenuContext>,
            baseState({rhsState: RHSStates.MENTION, searchTerms: '@me in:other-channel '}),
        );

        await userEvent.click(screen.getByRole('menuitem', {name: 'Recent Mentions in this Channel'}));
        expect(rhsActions.showChannelMentions).toHaveBeenCalledTimes(1);
        expect(rhsActions.closeRightHandSide).not.toHaveBeenCalled();
    });

    test('re-scopes when the panel shows unscoped recent mentions', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <ViewChannelMentions/>
            </WithTestMenuContext>,
            baseState({rhsState: RHSStates.MENTION, searchTerms: '@me '}),
        );

        await userEvent.click(screen.getByRole('menuitem', {name: 'Recent Mentions in this Channel'}));
        expect(rhsActions.showChannelMentions).toHaveBeenCalledTimes(1);
        expect(rhsActions.closeRightHandSide).not.toHaveBeenCalled();
    });
});
