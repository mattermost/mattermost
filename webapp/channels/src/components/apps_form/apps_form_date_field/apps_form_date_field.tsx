// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DatePicker from 'components/date_picker/date_picker';

import {stringToMoment, momentToString, resolveRelativeDate} from 'utils/date_utils';

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
};

const AppsFormDateField: React.FC<Props> = ({
    field,
    value,
    onChange,
}) => {
    const intl = useIntl();
    const timezone = useSelector(getCurrentTimezone);
    const [isPopperOpen, setIsPopperOpen] = useState(false);

    const momentValue = useMemo(() => {
        return stringToMoment(value, timezone);
    }, [value, timezone]);

    const displayValue = useMemo(() => {
        if (!momentValue) {
            return '';
        }

        // Format in user's locale using Intl.DateTimeFormat
        try {
            const date = new Date(momentValue.year(), momentValue.month(), momentValue.date());
            if (isNaN(date.getTime())) {
                return '';
            }
            return new Intl.DateTimeFormat(intl.locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(date);
        } catch {
            return '';
        }
    }, [momentValue, intl.locale]);

    const handleDateChange = useCallback((date: Date | undefined) => {
        if (!date) {
            return;
        }

        // Create a new moment directly from the Date object in the user's timezone
        const newMoment = timezone ? moment.tz(date, timezone) : moment(date);

        const newValue = momentToString(newMoment, false);
        onChange(field.name, newValue);
        setIsPopperOpen(false);
    }, [field.name, onChange, timezone]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
    }, []);

    // Calculate disabled days based on min_date and max_date constraints
    const disabledDays = useMemo(() => {
        const disabled = [];

        // Disable dates before min_date
        if (field.min_date) {
            const resolvedMinDate = resolveRelativeDate(field.min_date);
            const minMoment = stringToMoment(resolvedMinDate, timezone);
            if (minMoment) {
                const minDate = new Date(minMoment.year(), minMoment.month(), minMoment.date());
                disabled.push({before: minDate});
            }
        }

        // Disable dates after max_date
        if (field.max_date) {
            const resolvedMaxDate = resolveRelativeDate(field.max_date);
            const maxMoment = stringToMoment(resolvedMaxDate, timezone);
            if (maxMoment) {
                const maxDate = new Date(maxMoment.year(), maxMoment.month(), maxMoment.date());
                disabled.push({after: maxDate});
            }
        }

        return disabled.length > 0 ? disabled : undefined;
    }, [field.min_date, field.max_date, timezone]);

    const placeholder = field.hint || intl.formatMessage({
        id: 'apps_form.date_field.placeholder',
        defaultMessage: 'Select a date',
    });

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    return (
        <div>
            <DatePicker
                isPopperOpen={isPopperOpen}
                handlePopperOpenState={handlePopperOpenState}
                locale={intl.locale}
                datePickerProps={{
                    mode: 'single',
                    selected: momentValue ? new Date(momentValue.year(), momentValue.month(), momentValue.date()) : undefined,
                    defaultMonth: momentValue ? new Date(momentValue.year(), momentValue.month(), momentValue.date()) : undefined,
                    onSelect: handleDateChange,
                    disabled: field.readonly ? true : disabledDays,
                }}
                value={displayValue || undefined}
                icon={calendarIcon}
            >
                <span className='date-time-input__value'>{placeholder}</span>
            </DatePicker>
        </div>
    );
};

export default AppsFormDateField;
