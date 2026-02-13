// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {showMentions} from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

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
});
