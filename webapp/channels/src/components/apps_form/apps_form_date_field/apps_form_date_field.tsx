// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {AppField} from '@mattermost/types/apps';

import {DateRangePicker} from '@mattermost/compass-ui/components/date-range-picker';

import {stringToDate, formatDateForDisplay} from 'utils/date_utils';

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
}) => {
    const intl = useIntl();

    const isoValue = value && stringToDate(value) ? value : undefined;

    const handleDateChange = useCallback((date: string) => {
        onChange(field.name, date);
    }, [field.name, onChange]);

    const formatDate = useCallback((iso: string) => {
        const date = stringToDate(iso);
        if (!date) {
            return '';
        }

        try {
            return formatDateForDisplay(date, intl.locale);
        } catch {
            return '';
        }
    }, [intl.locale]);

    const monthNames = useMemo(
        () => Array.from({length: 12}, (_, month) => intl.formatDate(new Date(2020, month, 1), {month: 'long'})),
        [intl],
    );

    const weekdayNames = useMemo(
        () => Array.from({length: 7}, (_, day) => intl.formatDate(new Date(2020, 0, 5 + day), {weekday: 'short'})),
        [intl],
    );

    const placeholder = field.hint || intl.formatMessage({
        id: 'apps_form.date_field.placeholder',
        defaultMessage: 'Select a date',
    });

    return (
        <DateRangePicker
            mode='date'
            value={isoValue}
            onChange={handleDateChange}
            disabled={field.readonly}
            placeholder={placeholder}
            formatDate={formatDate}
            monthNames={monthNames}
            weekdayNames={weekdayNames}
            zIndex={1100}
            dialogLabel={intl.formatMessage({
                defaultMessage: 'Date picker',
                id: 'apps_form.date_field.dialog_label',
            })}
            todayLabel={intl.formatMessage({
                defaultMessage: 'Today',
                id: 'apps_form.date_field.today',
            })}
            previousMonthLabel={intl.formatMessage({
                defaultMessage: 'Previous month',
                id: 'apps_form.date_field.previous_month',
            })}
            nextMonthLabel={intl.formatMessage({
                defaultMessage: 'Next month',
                id: 'apps_form.date_field.next_month',
            })}
        />
    );
};

export default AppsFormDateField;
