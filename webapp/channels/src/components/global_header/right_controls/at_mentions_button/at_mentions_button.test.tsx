// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {closeRightHandSide, showMentions} from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AtMentionsButton from './at_mentions_button';

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RHS'})),
    showMentions: jest.fn(() => ({type: 'MOCK_SHOW_MENTIONS'})),
}));

describe('components/global/AtMentionsButton', () => {
    const initialState = {
        views: {
            rhs: {
                isSidebarOpen: true,
            },
        },
    } as unknown as GlobalState;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AtMentionsButton/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show active mentions', async () => {
        renderWithContext(
            <AtMentionsButton/>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Recent mentions'}));
        expect(showMentions).toHaveBeenCalledTimes(1);
    });

    test('should close the right-hand side when the unscoped mentions view is already showing', async () => {
        renderWithContext(
            <AtMentionsButton/>,
            {
                views: {
                    rhs: {
                        isSidebarOpen: true,
                        rhsState: RHSStates.MENTION,
                        searchTeam: null,
                    },
                },
            } as unknown as GlobalState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Recent mentions'}));
        expect(closeRightHandSide).toHaveBeenCalledTimes(1);
        expect(showMentions).not.toHaveBeenCalled();
    });

    test('should reopen all mentions when the mentions view is scoped to a single team', async () => {
        renderWithContext(
            <AtMentionsButton/>,
            {
                views: {
                    rhs: {
                        isSidebarOpen: true,
                        rhsState: RHSStates.MENTION,
                        searchTeam: 'team_id',
                    },
                },
            } as unknown as GlobalState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Recent mentions'}));
        expect(showMentions).toHaveBeenCalledTimes(1);
        expect(closeRightHandSide).not.toHaveBeenCalled();
    });
});
