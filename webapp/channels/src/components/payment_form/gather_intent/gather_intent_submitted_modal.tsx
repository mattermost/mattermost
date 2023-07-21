// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CheckCircleIcon} from '@mattermost/compass-icons/components';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import './gather_intent.scss';

export interface GatherIntentModalProps {
    onClose: () => void;
}

export const GatherIntentSubmittedModal = ({onClose}: GatherIntentModalProps) => {
    return (
        <>
            <Modal.Header className='AltPaymentsModal__header '>
                <button
                    id='closeIcon'
                    className='icon icon-close'
                    aria-label='Close'
                    title='Close'
                    onClick={onClose}
                />
            </Modal.Header>
            <Modal.Body className='AltPaymentsModal__body'>
                <div className='AltPaymentsModal__submitted-icon-container'>
                    <CheckCircleIcon/>
                </div>
                <FormattedMessage
                    id='gather_intent.feedback_saved'
                    defaultMessage='Thanks for sharing feedback!'
                >
                    {(text) => <span className='savedFeedback__text'>{text}</span>}
                </FormattedMessage>
            </Modal.Body>
            <Modal.Footer className={'AltPaymentsModal__footer '}>
                <button
                    className={'AltPaymentsModal__footer--primary'}
                    id={'feedbackSubmitedDone'}
                    type='button'
                    onClick={onClose}
                >
                    <FormattedMessage
                        id='generic.done'
                        defaultMessage='Done'
                    />
                </button>
            </Modal.Footer>
        </>);
};
