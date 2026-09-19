// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {CheckCircleIcon, CloseCircleIcon} from '@mattermost/compass-icons/components';

import './session_attributes.scss';

type Props = {
    enabled: boolean;
};

export default function StatusChip({enabled}: Props) {
    return (
        <span
            className='SessionAttributes__status-chip'
            data-testid='session-attribute-status'
            data-enabled={enabled}
        >
            {enabled ? (
                <CheckCircleIcon size={16}/>
            ) : (
                <CloseCircleIcon size={16}/>
            )}
            {enabled ? (
                <FormattedMessage
                    id='admin.session_attributes.status.enabled'
                    defaultMessage='Enabled'
                />
            ) : (
                <FormattedMessage
                    id='admin.session_attributes.status.disabled'
                    defaultMessage='Disabled'
                />
            )}
        </span>
    );
}
