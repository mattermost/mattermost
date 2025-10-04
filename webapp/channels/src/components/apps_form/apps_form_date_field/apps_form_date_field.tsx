// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import type {AppField} from '@mattermost/types/apps';

import DatePicker from 'components/date_picker/date_picker';

import {stringToDate, dateToString, resolveRelativeDate} from 'utils/date_utils';

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
    const [isPopperOpen, setIsPopperOpen] = useState(false);

    const dateValue = useMemo(() => {
        return stringToDate(value);
    }, [value]);

    const displayValue = useMemo(() => {
        if (!dateValue) {
            return '';
        }

        try {
            return new Intl.DateTimeFormat(intl.locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(dateValue);
        } catch {
            return '';
        }
    }, [dateValue, intl.locale]);

    const handleDateChange = useCallback((date: Date | undefined) => {
        if (!date) {
            return;
        }

        // Convert Date to ISO string (YYYY-MM-DD)
        const newValue = dateToString(date);
        onChange(field.name, newValue);
        setIsPopperOpen(false);
    }, [field.name, onChange]);

    const handlePopperOpenState = useCallback((isOpen: boolean) => {
        setIsPopperOpen(isOpen);
    }, []);

    const disabledDays = useMemo(() => {
        const disabled = [];

        if (field.min_date) {
            const resolvedMinDate = resolveRelativeDate(field.min_date);
            const minDate = stringToDate(resolvedMinDate);
            if (minDate) {
                disabled.push({before: minDate});
            }
        }

        if (field.max_date) {
            const resolvedMaxDate = resolveRelativeDate(field.max_date);
            const maxDate = stringToDate(resolvedMaxDate);
            if (maxDate) {
                disabled.push({after: maxDate});
            }
        }

        return disabled.length > 0 ? disabled : undefined;
    }, [field.min_date, field.max_date]);

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
                    selected: dateValue || undefined,
                    defaultMonth: dateValue || undefined,
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
