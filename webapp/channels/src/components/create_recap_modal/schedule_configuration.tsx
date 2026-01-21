// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentTimezone, getCurrentTimezoneLabel} from 'mattermost-redux/selectors/entities/timezone';

import DropdownInput from 'components/dropdown_input';
import Input from 'components/widgets/inputs/input/input';

import DayOfWeekSelector from './day_of_week_selector';

type Props = {
    daysOfWeek: number;
    setDaysOfWeek: (days: number) => void;
    timeOfDay: string;
    setTimeOfDay: (time: string) => void;
    timePeriod: string;
    setTimePeriod: (period: string) => void;
    customInstructions: string;
    setCustomInstructions: (instructions: string) => void;
    daysError?: boolean;
    timeError?: boolean;
};

// Generate time options in 30-minute intervals
const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const h = hour.toString().padStart(2, '0');
            const m = minute.toString().padStart(2, '0');
            options.push(`${h}:${m}`);
        }
    }
    return options;
};

const TIME_OPTIONS = generateTimeOptions();

const ScheduleConfiguration = ({
    daysOfWeek,
    setDaysOfWeek,
    timeOfDay,
    setTimeOfDay,
    timePeriod,
    setTimePeriod,
    customInstructions,
    setCustomInstructions,
    daysError,
    timeError,
}: Props) => {
    const {formatMessage, formatTime, formatDate} = useIntl();
    const userTimezone = useSelector(getCurrentTimezone);
    const timezoneLabel = useSelector(getCurrentTimezoneLabel);

    // Time period options
    const timePeriodOptions = useMemo(() => [
        {value: 'last_24h', label: formatMessage({id: 'recaps.timePeriod.last24h', defaultMessage: 'Previous day'})},
        {value: 'last_3_days', label: formatMessage({id: 'recaps.timePeriod.last3days', defaultMessage: 'Last 3 days'})},
        {value: 'last_7_days', label: formatMessage({id: 'recaps.timePeriod.last7days', defaultMessage: 'Last 7 days'})},
    ], [formatMessage]);

    // Time dropdown options with locale-aware labels
    const timeOptions = useMemo(() => {
        return TIME_OPTIONS.map((time) => {
            const [hours, minutes] = time.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return {
                value: time,
                label: formatTime(date, {hour: 'numeric', minute: '2-digit'}),
            };
        });
    }, [formatTime]);

    // Calculate next run preview
    const nextRunPreview = useMemo(() => {
        if (daysOfWeek === 0 || !timeOfDay) {
            return null;
        }

        const [hours, minutes] = timeOfDay.split(':').map(Number);
        const now = new Date();

        // Find the next occurrence
        // Start from today and check each day
        for (let daysAhead = 0; daysAhead < 8; daysAhead++) {
            const checkDate = new Date(now);
            checkDate.setDate(now.getDate() + daysAhead);
            checkDate.setHours(hours, minutes, 0, 0);

            // Get day of week (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = checkDate.getDay();
            const dayBit = 1 << dayOfWeek;

            // Check if this day is selected
            if ((daysOfWeek & dayBit) !== 0) {
                // Check if the time hasn't passed yet (or it's a future day)
                if (daysAhead > 0 || checkDate > now) {
                    // Format the preview
                    const diffDays = daysAhead;
                    let dateStr: string;

                    if (diffDays === 0) {
                        dateStr = formatMessage(
                            {id: 'recaps.nextRun.today', defaultMessage: 'Today at {time}'},
                            {time: formatTime(checkDate, {hour: 'numeric', minute: '2-digit'})},
                        );
                    } else if (diffDays === 1) {
                        dateStr = formatMessage(
                            {id: 'recaps.nextRun.tomorrow', defaultMessage: 'Tomorrow at {time}'},
                            {time: formatTime(checkDate, {hour: 'numeric', minute: '2-digit'})},
                        );
                    } else if (diffDays <= 7) {
                        dateStr = formatMessage(
                            {id: 'recaps.nextRun.dayAt', defaultMessage: '{day} at {time}'},
                            {
                                day: formatDate(checkDate, {weekday: 'long'}),
                                time: formatTime(checkDate, {hour: 'numeric', minute: '2-digit'}),
                            },
                        );
                    } else {
                        dateStr = formatMessage(
                            {id: 'recaps.nextRun.dateAt', defaultMessage: '{date} at {time}'},
                            {
                                date: formatDate(checkDate, {month: 'short', day: 'numeric'}),
                                time: formatTime(checkDate, {hour: 'numeric', minute: '2-digit'}),
                            },
                        );
                    }

                    // Add timezone
                    const tzAbbrev = timezoneLabel || userTimezone || '';
                    if (tzAbbrev) {
                        return `${dateStr} (${tzAbbrev})`;
                    }
                    return dateStr;
                }
            }
        }

        return null;
    }, [daysOfWeek, timeOfDay, formatMessage, formatTime, formatDate, userTimezone, timezoneLabel]);

    return (
        <div className='step-three'>
            {/* Days of week selection */}
            <div className='form-group'>
                <label className='form-label'>
                    <FormattedMessage
                        id='recaps.modal.selectDays'
                        defaultMessage='Select days'
                    />
                </label>
                <DayOfWeekSelector
                    value={daysOfWeek}
                    onChange={setDaysOfWeek}
                    error={daysError}
                />
                {daysError && (
                    <div className='form-error'>
                        <FormattedMessage
                            id='recaps.modal.selectDaysRequired'
                            defaultMessage='Please select at least one day'
                        />
                    </div>
                )}
            </div>

            {/* Time of day selection */}
            <div className='form-group'>
                <DropdownInput
                    name='timeOfDay'
                    legend={formatMessage({id: 'recaps.modal.selectTime', defaultMessage: 'Select time'})}
                    value={timeOptions.find((o) => o.value === timeOfDay)}
                    options={timeOptions}
                    onChange={(val) => setTimeOfDay(val.value)}
                    required={true}
                    error={timeError ? formatMessage({id: 'recaps.modal.selectTimeRequired', defaultMessage: 'Please select a time'}) : undefined}
                />
            </div>

            {/* Next run preview */}
            {nextRunPreview && (
                <div className='next-run-preview'>
                    <FormattedMessage
                        id='recaps.modal.nextRunPreview'
                        defaultMessage='Next recap: {preview}'
                        values={{preview: nextRunPreview}}
                    />
                </div>
            )}

            {/* Time period selection */}
            <div className='form-group'>
                <DropdownInput
                    name='timePeriod'
                    legend={formatMessage({id: 'recaps.modal.timePeriod', defaultMessage: 'Time period to cover'})}
                    value={timePeriodOptions.find((o) => o.value === timePeriod)}
                    options={timePeriodOptions}
                    onChange={(val) => setTimePeriod(val.value)}
                    required={true}
                />
            </div>

            {/* Custom instructions */}
            <div className='form-group'>
                <Input
                    type='textarea'
                    name='customInstructions'
                    label={formatMessage({id: 'recaps.modal.customInstructions', defaultMessage: 'Custom instructions (optional)'})}
                    placeholder={formatMessage({id: 'recaps.modal.customInstructionsPlaceholder', defaultMessage: 'Add any specific instructions for the AI...'})}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    limit={500}
                />
            </div>
        </div>
    );
};

export default ScheduleConfiguration;
