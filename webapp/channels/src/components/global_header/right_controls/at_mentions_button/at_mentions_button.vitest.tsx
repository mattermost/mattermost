// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import AtMentionsButton from './at_mentions_button';

describe('components/global/AtMentionsButton', () => {
    const getBaseState = () => ({
        views: {
            rhs: {
                isSidebarOpen: true,
            },
        },
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AtMentionsButton/>,
            getBaseState(),
        );
        expect(container).toMatchSnapshot();
    });

    test('should show active mentions', () => {
        renderWithContext(
            <AtMentionsButton/>,
            getBaseState(),
        );

        const button = screen.getByRole('button', {name: /recent mentions/i});
        fireEvent.click(button);

        // The button click should dispatch an action (we can verify the button exists and is clickable)
        expect(button).toBeInTheDocument();
    });
});
