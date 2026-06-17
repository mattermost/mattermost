// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useId} from 'react';
import {FormattedMessage} from 'react-intl';

import {formatTimezoneOffsetShort} from 'components/advanced_text_editor/send_button/schedule_message_utils';

import './schedule_recipient_timezone_checkbox.scss';

type Props = {
    checked: boolean;
    recipientTimezone: string;
    onChange: (checked: boolean) => void;
    className?: string;
    variant?: 'menu' | 'modal';
}

export default function ScheduleRecipientTimezoneCheckbox({
    checked,
    recipientTimezone,
    onChange,
    className,
    variant = 'menu',
}: Props) {
    const checkboxId = useId();

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        event.stopPropagation();
        onChange(event.target.checked);
    }, [onChange]);

    const handleClick = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
    }, []);

    const offset = formatTimezoneOffsetShort(recipientTimezone);
    const inputId = `schedule-recipient-timezone-${checkboxId}`;

    const label = (
        <FormattedMessage
            id='schedule_message.use_recipient_timezone'
            defaultMessage="Use recipient's timezone ({offset})"
            values={{offset}}
        />
    );

    if (variant === 'modal') {
        return (
            <div
                className={classNames('ScheduleRecipientTimezoneCheckbox', 'ScheduleRecipientTimezoneCheckbox--modal', className)}
                onClick={handleClick}
            >
                <div className='mm-modal-generic-section-item__fieldset-checkbox-ctr'>
                    <input
                        id={inputId}
                        type='checkbox'
                        className='mm-modal-generic-section-item__input-checkbox'
                        checked={checked}
                        onChange={handleChange}
                    />
                    <label
                        htmlFor={inputId}
                        className='mm-modal-generic-section-item__fieldset-checkbox'
                    >
                        {label}
                    </label>
                </div>
            </div>
        );
    }

    return (
        <div
            className={classNames('ScheduleRecipientTimezoneCheckbox', 'ScheduleRecipientTimezoneCheckbox--menu', className)}
            onClick={handleClick}
        >
            <input
                id={inputId}
                type='checkbox'
                className='ScheduleRecipientTimezoneCheckbox__input'
                checked={checked}
                onChange={handleChange}
            />
            <label
                htmlFor={inputId}
                className='ScheduleRecipientTimezoneCheckbox__label'
            >
                {label}
            </label>
        </div>
    );
}
