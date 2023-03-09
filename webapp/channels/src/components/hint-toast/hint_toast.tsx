// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CloseIcon from 'components/widgets/icons/close_icon';

import './hint_toast.scss';

type Props = {
    children: React.ReactNode;
    onDismiss: () => void;
}

export const HintToast: React.FC<Props> = ({children, onDismiss}: Props) => {
    const handleDismiss = () => {
        if (typeof onDismiss === 'function') {
            onDismiss();
        }
    };

    return (
        <div className='hint-toast__wrapper'>
            <div className='hint-toast'>
                <div
                    className='hint-toast__message'
                >
                    {children}
                </div>
                <div
                    className='hint-toast__dismiss'
                    onClick={handleDismiss}
                    data-testid='dismissHintToast'
                >
                    <CloseIcon
                        className='close-btn'
                        id='dismissHintToast'
                    />
                </div>
            </div>
        </div>
    );
};
