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
            const parsed = stringToMoment(value, timezone);
            if (parsed) {
                return parsed;
            }
        }

        // Default to current time for display only
        return timezone ? moment.tz(timezone) : moment();
    }, [value, timezone]);

    const handleDateTimeChange = useCallback((date: moment.Moment) => {
        const newValue = momentToString(date, true);
        onChange(field.name, newValue);
    }, [field.name, onChange]);

    const timePickerInterval = field.time_interval || DEFAULT_TIME_INTERVAL_MINUTES;

    const allowPastDates = useMemo(() => {
        if (field.min_date) {
            const resolvedMinDate = resolveRelativeDate(field.min_date);
            const minMoment = stringToMoment(resolvedMinDate, timezone);
            const currentMoment = timezone ? moment.tz(timezone) : moment();

            return !minMoment || minMoment.isBefore(currentMoment, 'day');
        }

        return true;
    }, [field.min_date, timezone]);

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
