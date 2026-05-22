// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import type {SchedulePerspective} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import {formatTimezoneOffsetShort} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import Timestamp, {RelativeRanges} from 'components/timestamp';

import './schedule_dual_time_preview.scss';

type Props = {
    selectedDateTime: Moment;
    perspective: SchedulePerspective;
    recipientName: string;
    senderTimezone: string;
    recipientTimezone: string;
    showRecipientLine?: boolean;
}

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

function PreviewTime({value, timeZone}: {value: number; timeZone: string}) {
    return (
        <Timestamp
            ranges={DATE_RANGES}
            value={value}
            timeZone={timeZone}
            useDate={DATE_RANGES}
            useTime={{
                hour: 'numeric',
                minute: 'numeric',
            }}
        />
    );
}

export default function ScheduleDualTimePreview({
    selectedDateTime,
    perspective,
    recipientName,
    senderTimezone,
    recipientTimezone,
    showRecipientLine = true,
}: Props) {
    const scheduledAt = selectedDateTime.valueOf();

    const senderOffset = useMemo(
        () => formatTimezoneOffsetShort(senderTimezone, selectedDateTime),
        [senderTimezone, selectedDateTime],
    );

    const recipientPrimary = perspective === 'theirs';
    const senderPrimary = perspective === 'mine';

    return (
        <div
            className='ScheduleDualTimePreview'
            aria-live='polite'
        >
            {showRecipientLine && (
                <div className={classNames('ScheduleDualTimePreview__row', {primary: recipientPrimary, secondary: !recipientPrimary})}>
                    <span className='ScheduleDualTimePreview__label'>
                        <FormattedMessage
                            id='schedule_post.custom_time_modal.preview.recipient_receives'
                            defaultMessage='{recipientName} receives at'
                            values={{recipientName}}
                        />
                    </span>
                    <span className='ScheduleDualTimePreview__value'>
                        <PreviewTime
                            value={scheduledAt}
                            timeZone={recipientTimezone}
                        />
                    </span>
                </div>
            )}
            <div className={classNames('ScheduleDualTimePreview__row', {primary: senderPrimary, secondary: !senderPrimary})}>
                <span className='ScheduleDualTimePreview__label'>
                    <FormattedMessage
                        id='schedule_post.custom_time_modal.preview.you_send'
                        defaultMessage='You send at'
                    />
                </span>
                <span className='ScheduleDualTimePreview__value'>
                    <PreviewTime
                        value={scheduledAt}
                        timeZone={senderTimezone}
                    />
                    {' '}
                    <span className='ScheduleDualTimePreview__offset'>
                        ({senderOffset})
                    </span>
                </span>
            </div>
        </div>
    );
}
