// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useId} from 'react';
import {FormattedMessage} from 'react-intl';

import {formatTimezoneOffsetShort} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';

import './schedule_recipient_timezone_checkbox.scss';

type Props = {
    checked: boolean;
    recipientTimezone: string;
    onChange: (checked: boolean) => void;
    className?: string;
}

export default function ScheduleRecipientTimezoneCheckbox({
    checked,
    recipientTimezone,
    onChange,
    className,
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

    return (
        <div
            className={classNames('ScheduleRecipientTimezoneCheckbox', className)}
            onClick={handleClick}
        >
            <input
                id={checkboxId}
                type='checkbox'
                className='ScheduleRecipientTimezoneCheckbox__input'
                checked={checked}
                onChange={handleChange}
            />
            <label
                htmlFor={checkboxId}
                className='ScheduleRecipientTimezoneCheckbox__label'
            >
                <FormattedMessage
                    id='schedule_message.use_recipient_timezone'
                    defaultMessage="Use recipient's timezone ({offset})"
                    values={{offset}}
                />
            </label>
        </div>
    );
}
