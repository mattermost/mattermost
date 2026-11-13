// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Toast} from '@mattermost/compass-ui/components/toast';
import React from 'react';
import {useIntl} from 'react-intl';

import './hint_toast.scss';

export const HINT_TOAST_TESTID = 'hint-toast';

type Props = {
    children: React.ReactNode;
    onDismiss: () => void;
};

export const HintToast: React.FC<Props> = ({children, onDismiss}: Props) => {
    const {formatMessage} = useIntl();

    const handleDismiss = () => {
        if (typeof onDismiss === 'function') {
            onDismiss();
        }
    };

    const dismissLabel = formatMessage({id: 'general_button.close', defaultMessage: 'Close'});

    return (
        <Toast
            data-testid={HINT_TOAST_TESTID}
            className='hint-toast'
            type='general'
            message={
                <span className='hint-toast__message'>
                    {children}
                </span>
            }
            onDismiss={handleDismiss}
            dismissLabel={dismissLabel}
            dismissButtonProps={{
                'data-testid': 'dismissHintToast',
            }}
        />
    );
};
