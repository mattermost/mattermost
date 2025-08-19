// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString, resolveRelativeDate} from 'utils/date_utils';

// Default time interval for DateTime fields in minutes
const DEFAULT_TIME_INTERVAL_MINUTES = 60;

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
};

const AppsFormDateTimeField: React.FC<Props> = ({
    field,
    value,
    onChange,
}) => {
    const timezone = useSelector(getCurrentTimezone);

    const momentValue = useMemo(() => {
        if (value) {
            const parsed = stringToMoment(value, timezone, true); // true = datetime field
            if (parsed) {
                return parsed;
            }
        }

        // DISPLAY FALLBACK ONLY: Current time shown in UI when no value exists
        // This does not set the form value - actual defaults should be set in initFormValues
        // User must interact to save this time to the form
        return timezone ? moment.tz(timezone) : moment();
    }, [value, timezone]);

    const handleDateTimeChange = useCallback((date: moment.Moment) => {
        const newValue = momentToString(date, true);
        onChange(field.name, newValue);
    }, [field.name, onChange]);

    const timePickerInterval = field.time_interval || DEFAULT_TIME_INTERVAL_MINUTES;

    // Determine if past dates should be allowed based on min_date constraint
    const allowPastDates = useMemo(() => {
        // If there's a min_date constraint, check if it allows past dates
        if (field.min_date) {
            const resolvedMinDate = resolveRelativeDate(field.min_date);
            const minMoment = stringToMoment(resolvedMinDate, timezone, false); // min_date should be date-only
            const currentMoment = timezone ? moment.tz(timezone) : moment();

            // If min_date is today or in the future, don't allow past dates
            return !minMoment || minMoment.isBefore(currentMoment, 'day');
        }

        // Default: allow past dates if no min_date constraint
        return true;
    }, [field.min_date, timezone]);

    // Validation is now handled centrally in integration_utils.ts

    return (
        <div className='apps-form-datetime-input'>
            <DateTimeInput
                time={momentValue}
                handleChange={handleDateTimeChange}
                timezone={timezone}
                relativeDate={true}
                timePickerInterval={timePickerInterval}
                allowPastDates={allowPastDates}
            />
        </div>
    );
};

export default AppsFormDateTimeField;
