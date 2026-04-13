// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import type {AppField} from '@mattermost/types/apps';

import DatePicker from 'components/date_picker/date_picker';

import {stringToDate, dateToString, resolveRelativeDate, formatDateForDisplay} from 'utils/date_utils';

type Props = {
    field: AppField;
    value: string | null;
    onChange: (name: string, value: string | null) => void;
    setIsInteracting?: (isInteracting: boolean) => void;
};

const AppsFormDateField: React.FC<Props> = ({
    field,
    value,
    onChange,
    setIsInteracting,
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
            return formatDateForDisplay(dateValue, intl.locale);
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
        setIsInteracting?.(isOpen);
    }, [setIsInteracting]);

    // Resolve effective min/max dates (datetime_config takes precedence over deprecated top-level fields)
    const effectiveMinDate = field.datetime_config?.min_date ?? field.min_date;
    const effectiveMaxDate = field.datetime_config?.max_date ?? field.max_date;

    const disabledDays = useMemo(() => {
        const disabled = [];

        if (effectiveMinDate) {
            const resolvedMinDate = resolveRelativeDate(effectiveMinDate);
            const minDate = stringToDate(resolvedMinDate);
            if (minDate) {
                disabled.push({before: minDate});
            }
        }

        if (effectiveMaxDate) {
            const resolvedMaxDate = resolveRelativeDate(effectiveMaxDate);
            const maxDate = stringToDate(resolvedMaxDate);
            if (maxDate) {
                disabled.push({after: maxDate});
            }
        }

        return disabled.length > 0 ? disabled : undefined;
    }, [effectiveMinDate, effectiveMaxDate]);

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
