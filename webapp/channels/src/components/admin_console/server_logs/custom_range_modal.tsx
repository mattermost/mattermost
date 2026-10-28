// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';
import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getCurrentTimezone, getCurrentTimezoneLabel} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput from 'components/datetime_input/datetime_input';

import type {CustomTimeRange} from './types';

import './custom_range_modal.scss';

const DEFAULT_RANGE_MS = 60 * 60 * 1000;

type Props = {
    initialRange: CustomTimeRange | null;
    onConfirm: (range: CustomTimeRange) => void;
    onExited: () => void;
};

export default function CustomRangeModal({initialRange, onConfirm, onExited}: Props) {
    const intl = useIntl();
    const timezone = useSelector(getCurrentTimezone);
    const timezoneLabel = useSelector(getCurrentTimezoneLabel);

    // The pickers clamp both bounds to this, so the end can't be in the future
    const [now] = useState(() => moment.tz(timezone).startOf('minute'));
    const [from, setFrom] = useState<Moment>(() => (initialRange ? moment.tz(initialRange.from, timezone) : now.clone().subtract(DEFAULT_RANGE_MS, 'ms')));
    const [to, setTo] = useState<Moment>(() => (initialRange ? moment.tz(initialRange.to, timezone).startOf('minute') : now));

    // Keeps Escape for an open date or time popup instead of closing the modal. One flag per
    // input, so one popup closing can't clear the flag while the other is opening
    const [isFromInteracting, setIsFromInteracting] = useState(false);
    const [isToInteracting, setIsToInteracting] = useState(false);

    const [hasFromTimeError, setHasFromTimeError] = useState(false);
    const [hasToTimeError, setHasToTimeError] = useState(false);

    const isOrdered = from.isBefore(to);
    const isValid = isOrdered && !hasFromTimeError && !hasToTimeError;

    // The pickers work in whole minutes, so the end covers everything logged during its minute
    const handleConfirm = () => {
        if (isValid) {
            onConfirm({from: from.valueOf(), to: to.clone().endOf('minute').valueOf()});
        }
    };

    return (
        <GenericModal
            id='serverLogsCustomRangeModal'
            className='ServerLogsCustomRangeModal'
            ariaLabel={intl.formatMessage({id: 'admin.logs.customRange.title', defaultMessage: 'Custom time range'})}
            modalHeaderText={
                <FormattedMessage
                    id='admin.logs.customRange.title'
                    defaultMessage='Custom time range'
                />
            }
            modalSubheaderText={
                <FormattedMessage
                    id='admin.logs.customRange.timezone'
                    defaultMessage='Times are in your timezone: {timezone}'
                    values={{timezone: timezoneLabel}}
                />
            }
            confirmButtonText={
                <FormattedMessage
                    id='admin.logs.customRange.apply'
                    defaultMessage='Apply'
                />
            }
            handleConfirm={handleConfirm}
            handleCancel={onExited}
            onExited={onExited}
            isConfirmDisabled={!isValid}
            errorText={isOrdered ? undefined : intl.formatMessage({id: 'admin.logs.customRange.errorOrder', defaultMessage: 'The start must be before the end.'})}
            autoCloseOnConfirmButton={false}
            compassDesign={true}
            keyboardEscape={!isFromInteracting && !isToInteracting}
            enforceFocus={false}
            bodyOverflowVisible={true}
        >
            <fieldset className='ServerLogsCustomRangeModal__bound'>
                <legend>
                    <FormattedMessage
                        id='admin.logs.customRange.from'
                        defaultMessage='From'
                    />
                </legend>
                <DateTimeInput
                    time={from}
                    handleChange={(time) => time && setFrom(time)}
                    timezone={timezone}
                    setIsInteracting={setIsFromInteracting}
                    onTimeInputError={setHasFromTimeError}
                    allowPastDates={true}
                    manualTimeEntry={true}
                    maxDateTime={now}
                />
            </fieldset>
            <fieldset className='ServerLogsCustomRangeModal__bound'>
                <legend>
                    <FormattedMessage
                        id='admin.logs.customRange.to'
                        defaultMessage='To'
                    />
                </legend>
                <DateTimeInput
                    time={to}
                    handleChange={(time) => time && setTo(time)}
                    timezone={timezone}
                    setIsInteracting={setIsToInteracting}
                    onTimeInputError={setHasToTimeError}
                    allowPastDates={true}
                    manualTimeEntry={true}
                    maxDateTime={now}
                />
            </fieldset>
        </GenericModal>
    );
}
