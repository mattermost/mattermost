// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import React, {useCallback, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import DateTimeInput, {getRoundedTime} from 'components/custom_status/date_time_input';

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
};

export default function DateTimePickerModal({onExited,
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
}: Props) {
    const userTimezone = useSelector(getCurrentTimezone);
    const currentTime = getCurrentMomentForTimezone(userTimezone);
    const initialRoundedTime = getRoundedTime(currentTime);

    const [dateTime, setDateTime] = useState(initialTime || initialRoundedTime);

    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && !isDatePickerOpen) {
                event.preventDefault();
                event.stopPropagation();
                onExited?.();
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDatePickerOpen, onExited]);

    const handleChange = useCallback((dateTime: Moment) => {
        setDateTime(dateTime);
        onChange?.(dateTime);
    }, [onChange]);

    const handleConfirm = useCallback(() => {
        onConfirm?.(dateTime);
    }, [dateTime, onConfirm]);

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
            handleEnterKeyPress={handleConfirm}
            className={'date-time-picker-modal'}
            compassDesign={true}
            keyboardEscape={false}
            cancelButtonText={cancelButtonText}
        >
            {bodyPrefix}

            <DateTimeInput
                time={dateTime}
                handleChange={handleChange}
                timezone={userTimezone}
                setIsDatePickerOpen={setIsDatePickerOpen}
                relativeDate={relativeDate}
            />

            {bodySuffix}
        </GenericModal>
    );
}
