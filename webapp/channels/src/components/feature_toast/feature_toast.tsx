// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FloatingPortal} from '@floating-ui/react';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {PlaylistCheckIcon, CloseIcon} from '@mattermost/compass-icons/components';

import {isAnyModalOpen} from 'selectors/views/modals';

import WithTooltip from 'components/with_tooltip';

import {RootHtmlPortalId} from 'utils/constants';

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
    const anyModalOpen = useSelector(isAnyModalOpen);

    if (!show || anyModalOpen) {
        return null;
    }

    const handleDismiss = () => {
        onDismiss();
    };

    return (
        <FloatingPortal id={RootHtmlPortalId}>
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
                        <WithTooltip
                            title={formatMessage({id: 'feature_toast.tooltipCloseBtn', defaultMessage: 'Close'})}
                        >
                            <button
                                className='btn btn-icon btn-sm'
                                onClick={handleDismiss}
                                aria-label={formatMessage({id: 'feature_toast.tooltipCloseBtn', defaultMessage: 'Close'})}
                            >
                                <CloseIcon size={18}/>
                            </button>
                        </WithTooltip>
                    </div>
                    <p>{message}</p>
                    <div className='feature_toast__actions'>
                        {showButton && (
                            <button
                                className='btn btn-primary'
                                onClick={handleDismiss}
                            >
                                {buttonText}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </FloatingPortal>
    );
}
