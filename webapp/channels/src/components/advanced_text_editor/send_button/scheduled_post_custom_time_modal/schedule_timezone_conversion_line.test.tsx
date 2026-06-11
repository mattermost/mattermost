// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ScheduleTimezoneConversionLine from './schedule_timezone_conversion_line';

describe('ScheduleTimezoneConversionLine', () => {
    const selectedDateTime = moment.tz('2026-06-10 09:00', 'Europe/London');

    it('renders your time when useRecipientTimezone is true', () => {
        renderWithContext(
            <ScheduleTimezoneConversionLine
                selectedDateTime={selectedDateTime}
                useRecipientTimezone={true}
                recipientName='Sarah'
                senderTimezone='America/New_York'
                recipientTimezone='Europe/London'
            />,
        );

        expect(screen.getByText(/your time/)).toBeInTheDocument();
        expect(screen.queryByText(/Sarah's time/)).not.toBeInTheDocument();
    });

    it('renders recipient time when useRecipientTimezone is false', () => {
        renderWithContext(
            <ScheduleTimezoneConversionLine
                selectedDateTime={selectedDateTime}
                useRecipientTimezone={false}
                recipientName='Sarah'
                senderTimezone='America/New_York'
                recipientTimezone='Europe/London'
            />,
        );

        expect(screen.getByText(/Sarah's time/)).toBeInTheDocument();
        expect(screen.queryByText(/your time/)).not.toBeInTheDocument();
    });
});
