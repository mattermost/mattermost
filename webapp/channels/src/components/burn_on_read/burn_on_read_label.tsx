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

    return (
        <div className='BurnOnReadLabel'>
            <div className='BurnOnReadLabel__badge'>
                <FireIcon
                    size={10}
                    className='BurnOnReadLabel__icon'
                />
                <span className='BurnOnReadLabel__text'>
                    {formatMessage(
                        {
                            id: 'burn_on_read.label.text',
                            defaultMessage: 'BURN ON READ ({duration}m)',
                        },
                        {duration: durationMinutes},
                    )}
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
