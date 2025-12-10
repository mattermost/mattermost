// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon, FireIcon} from '@mattermost/compass-icons/components';

import './burn_on_read_label.scss';

type Props = {

    // Whether the close button should be shown
    canRemove: boolean;

    // Callback when the close button is clicked
    onRemove: () => void;

    // The configured duration in minutes for BoR messages
    durationMinutes: number;
}

const BurnOnReadLabel = ({canRemove, onRemove, durationMinutes}: Props) => {
    const {formatMessage} = useIntl();

    const formatDuration = () => {
        if (durationMinutes >= 60) {
            const hours = Math.floor(durationMinutes / 60);
            const remainingMinutes = durationMinutes % 60;

            if (remainingMinutes === 0) {
                return formatMessage(
                    {
                        id: 'burn_on_read.label.text.hours',
                        defaultMessage: 'BURN ON READ ({hours}h)',
                    },
                    {hours},
                );
            }

            return formatMessage(
                {
                    id: 'burn_on_read.label.text.hours_minutes',
                    defaultMessage: 'BURN ON READ ({hours}h {minutes}m)',
                },
                {hours, minutes: remainingMinutes},
            );
        }

        return formatMessage(
            {
                id: 'burn_on_read.label.text',
                defaultMessage: 'BURN ON READ ({duration}m)',
            },
            {duration: durationMinutes},
        );
    };

    return (
        <div className='BurnOnReadLabel'>
            <div className='BurnOnReadLabel__badge'>
                <FireIcon
                    size={10}
                    className='BurnOnReadLabel__icon'
                />
                <span className='BurnOnReadLabel__text'>
                    {formatDuration()}
                </span>
            </div>
            {canRemove && (
                <button
                    className='BurnOnReadLabel__close'
                    onClick={onRemove}
                    aria-label={formatMessage({
                        id: 'burn_on_read.label.remove',
                        defaultMessage: 'Remove burn-on-read',
                    })}
                >
                    <CloseIcon size={14}/>
                </button>
            )}
        </div>
    );
};

export default memo(BurnOnReadLabel);
