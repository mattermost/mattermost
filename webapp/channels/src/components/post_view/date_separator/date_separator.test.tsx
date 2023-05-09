// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import DateSeparator from 'components/post_view/date_separator/date_separator';
import {screen} from '@testing-library/react';
import {renderWithIntlAndStore} from 'tests/react_testing_utils';

describe('components/post_view/DateSeparator', () => {
    const initialState = {
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as any;
    test('should render Timestamp inside of a BasicSeparator and pass date/value to it', () => {
        const value = new Date('Fri Jan 12 2018 20:15:13 GMT+1200 (+12)');
        renderWithIntlAndStore(
            <DateSeparator
                date={value}
            />, initialState,
        );

        expect(screen.getByTestId('basicSeparator')).toBeInTheDocument();

        expect(screen.getByText('January 12, 2018')).toBeInTheDocument();
    });
});
