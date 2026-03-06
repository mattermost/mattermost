// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput from 'components/datetime_input/datetime_input';

import {stringToMoment, momentToString} from 'utils/date_utils';
import {getCurrentMomentForTimezone} from 'utils/timezone';

// Default time interval for DateTime fields in minutes
const DEFAULT_TIME_INTERVAL_MINUTES = 60;

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
    setIsInteracting?: (isInteracting: boolean) => void;
};

// Helper to get timezone abbreviation (e.g., "MST", "EDT")
const getTimezoneAbbreviation = (timezone: string): string => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short',
        });
        const parts = formatter.formatToParts(now);
        const tzPart = parts.find((part) => part.type === 'timeZoneName');
        return tzPart?.value || timezone;
    } catch {
        return timezone;
    }
};

const AppsFormDateTimeField: React.FC<Props> = ({
    field,
    value,
    onChange,
    setIsInteracting,
}) => {
    const {formatMessage} = useIntl();
    const userTimezone = useSelector(getCurrentTimezone);

    // datetime_config is pre-merged with deprecated top-level fields by createSanitizedField
    const config = field.datetime_config || {};
    const locationTimezone = config.location_timezone;
    const timePickerInterval = config.time_interval ?? DEFAULT_TIME_INTERVAL_MINUTES;
    const allowManualTimeEntry = config.allow_manual_time_entry ?? false;

    // Use location_timezone if specified, otherwise fall back to user's timezone
    const timezone = locationTimezone || userTimezone;

    // Show timezone indicator when location_timezone is set
    const showTimezoneIndicator = Boolean(locationTimezone);

    const momentValue = useMemo(() => {
        if (value) {
            const parsed = stringToMoment(value, timezone);
            if (parsed) {
                return parsed;
            }
        }

        // No automatic defaults - field starts empty
        // Required fields get a default from apps_form_component.tsx
        return null;
    }, [value, timezone]);

    const handleDateTimeChange = useCallback((date: moment.Moment | null) => {
        if (!date) {
            onChange(field.name, null);
            return;
        }
        const newValue = momentToString(date, true);
        onChange(field.name, newValue);
    }, [field.name, onChange]);

    const minDateTime = useMemo(() => {
        if (!config.min_date) {
            return undefined;
        }
        return stringToMoment(config.min_date, timezone) ?? undefined;
    }, [config.min_date, timezone]);

    const maxDateTime = useMemo(() => {
        if (!config.max_date) {
            return undefined;
        }
        return stringToMoment(config.max_date, timezone) ?? undefined;
    }, [config.max_date, timezone]);

    return (
        <div className='apps-form-datetime-input'>
            {showTimezoneIndicator && (
                <div className='apps-form-datetime-timezone'>
                    {formatMessage(
                        {id: 'datetime.timezone_indicator', defaultMessage: 'Times in {timezone}'},
                        {timezone: getTimezoneAbbreviation(timezone)},
                    )}
                </div>
            )}
            <DateTimeInput
                time={momentValue}
                handleChange={handleDateTimeChange}
                timezone={timezone}
                relativeDate={!locationTimezone}
                timePickerInterval={timePickerInterval}
                allowManualTimeEntry={allowManualTimeEntry}
                setIsInteracting={setIsInteracting}
                minDateTime={minDateTime}
                maxDateTime={maxDateTime}
            />
        </div>
    );
};

export default AppsFormDateTimeField;
