// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CloseIcon from 'components/widgets/icons/close_icon';

import './hint_toast.scss';

export const HINT_TOAST_TESTID = 'center.post_list.search_hint';

type Props = {
    children: React.ReactNode;
    onDismiss: () => void;
};

export const HintToast: React.FC<Props> = ({children, onDismiss}: Props) => {
    const handleDismiss = () => {
        if (typeof onDismiss === 'function') {
            onDismiss();
        }
    };

    return (
        <div
            data-testid={HINT_TOAST_TESTID}
            className='hint-toast'
        >
            <div
                className='hint-toast__message'
            >
                {children}
            </div>
            <div
                className='hint-toast__dismiss'
                onClick={handleDismiss}
                role='button'
                data-testid={`${HINT_TOAST_TESTID}.dismiss--button`}
            >
                <CloseIcon
                    className='close-btn'
                    id='dismissHintToast'
                />
            </div>
        </div>
    );
};
