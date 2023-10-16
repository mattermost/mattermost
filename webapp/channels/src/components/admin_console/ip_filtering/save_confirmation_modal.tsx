// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Button, Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import ExternalLink from 'components/external_link';

import './save_confirmation_modal.scss';

type Props = {
    onClose?: () => void;
    onConfirm?: () => void;
    title?: string;
    subtitle: JSX.Element | string;
    buttonText?: string;
    includeDisclaimer?: boolean;
}

export default function SaveConfirmationModal({onClose, onConfirm, title, subtitle, includeDisclaimer, buttonText}: Props) {
    const {formatMessage} = useIntl();
    return (
        <Modal
            className={'SaveConfirmationModal'}
            dialogClassName={'SaveConfirmationModal__dialog'}
            show={true}
            onHide={() => onClose?.()}
        >
            <Modal.Header closeButton={true}>
                <div className='title'>
                    {title}
                </div>
            </Modal.Header>
            <Modal.Body>
                {subtitle}
                {includeDisclaimer &&
                    <div className='disclaimer'>
                        <div className='Icon'>
                            <InformationOutlineIcon/>
                        </div>
                        <div className='Body'>
                            <div className='Title'>{formatMessage({id: 'admin.ip_filtering.save_disclaimer_title', defaultMessage: 'Using the Customer Portal to restore access'})}</div>
                            {/* TODO - replace "workspace owner" with owner's email address? */}
                            <div className='Subtitle'>
                                {
                                    formatMessage(
                                        {
                                            id: 'admin.ip_filtering.save_disclaimer_subtitle',
                                            defaultMessage: 'If you happen to block yourself with these settings, your workspace owner can log in to the {customerportal} to disable IP filtering to restore access.',
                                        },
                                        {
                                            customerportal: (
                                                <ExternalLink
                                                    href='https://customers.mattermost.com/console/ip_filtering'
                                                    target='_blank'
                                                    rel='noreferrer'
                                                >
                                                    {'Customer Portal'}
                                                </ExternalLink>),
                                        },
                                    )
                                }
                            </div>
                        </div>
                    </div>
                }
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    className='btn-cancel'
                    onClick={() => onClose?.()}
                >
                    {formatMessage({id: 'admin.ip_filtering.cancel', defaultMessage: 'Cancel'})}
                </Button>
                <Button
                    data-testid='save-confirmation-button'
                    type='button'
                    className='btn-delete'
                    onClick={() => onConfirm?.()}
                >
                    {buttonText}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
