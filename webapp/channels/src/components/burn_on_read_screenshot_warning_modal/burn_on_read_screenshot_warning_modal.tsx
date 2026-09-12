// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './burn_on_read_screenshot_warning_modal.scss';

interface Props {

    show: boolean;
    onConfirm: () => void;
}

/**
 * Warning modal shown on screenshot attempt. Dismissable only via confirm button;
 * opaque backdrop prevents content capture while displayed.
 */
const BurnOnReadScreenshotWarningModal: React.FC<Props> = ({show, onConfirm}) => {
    const {formatMessage} = useIntl();

    const handleConfirm = useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    const title = formatMessage({
        id: 'post.burn_on_read.screenshot_warning.title',
        defaultMessage: 'Screenshots Not Allowed',
    });

    const message = formatMessage({
        id: 'post.burn_on_read.screenshot_warning.body',
        defaultMessage: 'Taking screenshots of Burn-on-Read messages is not permitted. These messages are designed to be temporary and confidential. Please respect the privacy of the conversation.',
    });

    const confirmButtonText = formatMessage({
        id: 'post.burn_on_read.screenshot_warning.acknowledge',
        defaultMessage: 'I Understand',
    });

    // No-op: forces dismissal through the confirm button only.
    const preventClose = useCallback((): void => {}, []);

    return (
        <GenericModal
            id='burnOnReadScreenshotWarningModal'
            className='BurnOnReadScreenshotWarningModal'
            show={show}
            modalHeaderText={title}
            onHide={preventClose}
            backdrop='static'
            keyboardEscape={false}
            backdropClassName='BurnOnReadScreenshotWarningModal__backdrop'
            showCloseButton={false}
            compassDesign={true}
            handleConfirm={handleConfirm}
            confirmButtonText={confirmButtonText}
            autoCloseOnConfirmButton={true}
        >
            <div className='BurnOnReadScreenshotWarningModal__body'>
                {message}
            </div>
        </GenericModal>
    );
};

export default BurnOnReadScreenshotWarningModal;
