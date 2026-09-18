// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import OutOfOfficeWarning from './out_of_office_warning';

describe('OutOfOfficeWarning', () => {
    test('should render display name and out of office label', () => {
        renderWithContext(
            <OutOfOfficeWarning displayName='Norma Fletcher'/>,
        );

        expect(screen.getByTestId('outOfOfficeWarning')).toBeInTheDocument();
        expect(screen.getByText('Norma Fletcher is Out of Office.')).toBeInTheDocument();
    });

    test('should show auto-reply message in tooltip on hover', async () => {
        jest.useFakeTimers();

        const message = "I'm off today on PTO. I'll be back on Monday, October 13th.";

        renderWithContext(
            <OutOfOfficeWarning
                displayName='Norma Fletcher'
                autoReplyMessage={message}
            />,
        );

        expect(screen.getByTestId('outOfOfficeWarning')).toHaveAttribute('tabindex', '0');

        await userEvent.hover(screen.getByTestId('outOfOfficeWarning'), {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText(message)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('should not wrap with tooltip when auto-reply message is empty', () => {
        renderWithContext(
            <OutOfOfficeWarning
                displayName='Norma Fletcher'
                autoReplyMessage=''
            />,
        );

        expect(screen.getByText('Norma Fletcher is Out of Office.')).toBeInTheDocument();
        expect(screen.getByTestId('outOfOfficeWarning')).not.toHaveAttribute('tabindex');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});
