// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DatePicker from 'components/date_picker/date_picker';

import {stringToMoment, momentToString} from 'utils/date_utils';

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
        const date = new Date(momentValue.year(), momentValue.month(), momentValue.date());
        return new Intl.DateTimeFormat(intl.locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(date);
    }, [momentValue, intl.locale]);

    const handleDateChange = useCallback((date: Date | undefined) => {
        if (!date) {
            return;
        }

        // Create a new moment directly from the Date object in the user's timezone
        const moment = require('moment-timezone');
        const newMoment = timezone ? moment.tz(date, timezone) : moment(date);

        const newValue = momentToString(newMoment, false);
        onChange(field.name, newValue);
        setIsPopperOpen(false);
    }, [field.name, onChange, timezone]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
    }, []);


    const placeholder = field.hint || intl.formatMessage({
        id: 'apps_form.date_field.placeholder',
        defaultMessage: 'Select a date',
    });

    const calendarIcon = (
        <i className='icon-calendar-outline'/>
    );

    return (
        <DatePicker
                isPopperOpen={isPopperOpen}
                handlePopperOpenState={handlePopperOpenState}
                locale={intl.locale}
                datePickerProps={{
                    mode: 'single',
                    selected: momentValue ? new Date(momentValue.year(), momentValue.month(), momentValue.date()) : undefined,
                    defaultMonth: momentValue ? new Date(momentValue.year(), momentValue.month(), momentValue.date()) : undefined,
                    onSelect: handleDateChange,
                    disabled: field.readonly,
                }}
                value={displayValue || undefined}
                icon={calendarIcon}
            >
                <span className='date-time-input__value'>{placeholder}</span>
            </DatePicker>
    );
};

export default AppsFormDateField;
