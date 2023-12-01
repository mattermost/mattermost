// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import FloatingTimestamp from './floating_timestamp';

describe('components/post_view/FloatingTimestamp', () => {
    const baseProps = {
        isScrolling: true,
        createAt: 1234,
        toastPresent: true,
        isRhsPost: false,
    };
    const initialState = {
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should match component state with given props', () => {
        renderWithContext(<FloatingTimestamp {...baseProps}/>, initialState);

        const floatingTimeStamp = screen.getByTestId('floatingTimestamp');
        const time = screen.getByText('January 01, 1970');

        expect(floatingTimeStamp).toBeInTheDocument();
        expect(floatingTimeStamp).toHaveClass('post-list__timestamp scrolling toastAdjustment');

        expect(time).toBeInTheDocument();
        expect(time).toHaveAttribute('datetime', '1970-01-01T00:00:01.234');
    });
});
