// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {PlaylistCheckIcon, CloseIcon} from '@mattermost/compass-icons/components';

import './feature_toast.scss';

type Props = {
    show: boolean;
    title: string;
    message: string | JSX.Element;
    showButton?: boolean;
    buttonText?: string;
    onDismiss: () => void;
};

export default function FeatureToast({
    show,
    title,
    message,
    showButton,
    buttonText,
    onDismiss,
}: Props) {
    const {formatMessage} = useIntl();

    if (!show) {
        return null;
    }

    return (
        <div
            role='status'
            aria-live='polite'
            aria-atomic='true'
            className='feature_toast'
        >
            <PlaylistCheckIcon
                size={24}
                color={'blue'}
                className='feature_toast__icon'
            />
            <div
                className='feature_toast__main_content'
            >
                <div
                    className='feature_toast__header_content'
                >
                    <h3>{title}</h3>
                    <button
                        onClick={onDismiss}
                        aria-label={formatMessage({id: 'feature_toast.tooltipCloseBtn', defaultMessage: 'Close'})}
                    >
                        <CloseIcon size={18}/>
                    </button>
                </div>
                <p>{message}</p>
                <div className='feature_toast__actions'>
                    {showButton && (
                        <button
                            className='btn btn-primary'
                            onClick={() => onDismiss()}
                        >
                            {buttonText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
