// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ScheduleRecipientTimezoneCheckbox from './schedule_recipient_timezone_checkbox';

describe('ScheduleRecipientTimezoneCheckbox', () => {
    it('renders checkbox with recipient timezone offset', () => {
        renderWithContext(
            <ScheduleRecipientTimezoneCheckbox
                checked={true}
                recipientTimezone='America/New_York'
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByText(/Use recipient's timezone/)).toBeInTheDocument();
        expect(screen.getByText(/UTC/)).toBeInTheDocument();
    });

    it('calls onChange when toggled', async () => {
        const onChange = jest.fn();

        renderWithContext(
            <ScheduleRecipientTimezoneCheckbox
                checked={true}
                recipientTimezone='America/New_York'
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('checkbox'));

        expect(onChange).toHaveBeenCalledWith(false);
    });
});
