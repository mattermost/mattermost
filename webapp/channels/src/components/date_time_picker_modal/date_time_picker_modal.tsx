// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classnames from 'classnames';
import type {Moment} from 'moment-timezone';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput, {getRoundedTime} from 'components/datetime_input/datetime_input';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import './style.scss';

type Props = {
    onExited?: () => void;
    ariaLabel: string;
    header: React.ReactNode;
    subheading?: React.ReactNode;
    onChange?: (dateTime: Moment) => void;
    onCancel?: () => void;
    onConfirm?: (dateTime: Moment) => void;
    initialTime?: Moment;
    confirmButtonText?: React.ReactNode;
    cancelButtonText?: React.ReactNode;
    bodyPrefix?: React.ReactNode;
    bodySuffix?: React.ReactNode;
    relativeDate?: boolean;
    className?: string;
    errorText?: string | React.ReactNode;
    timePickerInterval?: number;

    // Timezone the date and time are picked in. Defaults to the current user's timezone.
    timezone?: string;
};

export default function DateTimePickerModal({
    onExited,
    ariaLabel,
    header,
    onConfirm,
    onCancel,
    initialTime,
    confirmButtonText,
    onChange,
    cancelButtonText,
    subheading,
    bodyPrefix,
    bodySuffix,
    relativeDate,
    className,
    errorText,
    timePickerInterval,
    timezone,
}: Props) {
    const userTimezone = useSelector(getCurrentTimezone);
    const displayTimezone = timezone || userTimezone;
    const currentTime = getCurrentMomentForTimezone(displayTimezone);
    const initialRoundedTime = getRoundedTime(currentTime);

    const [dateTime, setDateTime] = useState(initialTime || initialRoundedTime);

    // When the timezone changes, keep the selected moment in time and only change how it's represented.
    const previousTimezone = useRef(displayTimezone);
    useEffect(() => {
        if (previousTimezone.current === displayTimezone) {
            return;
        }
        previousTimezone.current = displayTimezone;

        const converted = dateTime.clone().tz(displayTimezone);
        setDateTime(converted);
        onChange?.(converted);
    }, [displayTimezone]); // eslint-disable-line react-hooks/exhaustive-deps -- only convert when the timezone changes

    const [isInteracting, setIsInteracting] = useState(false);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && !isInteracting) {
                event.preventDefault();
                event.stopPropagation();
                onExited?.();
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isInteracting, onExited]);

    const handleChange = useCallback((dateTime: Moment | null) => {
        if (dateTime) {
            setDateTime(dateTime);
            onChange?.(dateTime);
        }
    }, [onChange]);

    const handleConfirm = useCallback(() => {
        onConfirm?.(dateTime);
    }, [dateTime, onConfirm]);

    const handleEnterKeyPress = useCallback(() => {
        if (!isInteracting) {
            handleConfirm();
        }
    }, [handleConfirm, isInteracting]);

    return (
        <GenericModal
            id='DateTimePickerModal'
            ariaLabel={ariaLabel}
            onExited={onExited}
            modalHeaderText={header}
            modalSubheaderText={subheading}
            confirmButtonText={confirmButtonText}
            handleConfirm={handleConfirm}
            handleCancel={onCancel}
            handleEnterKeyPress={handleEnterKeyPress}
            className={classnames('date-time-picker-modal', className)}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            cancelButtonText={cancelButtonText}
            autoCloseOnConfirmButton={false}
            errorText={errorText}
        >
            {bodyPrefix}

            <DateTimeInput
                time={dateTime}
                handleChange={handleChange}
                timezone={displayTimezone}
                setIsInteracting={setIsInteracting}
                relativeDate={relativeDate}
                timePickerInterval={timePickerInterval}
            />

            {bodySuffix}
        </GenericModal>
    );
}
