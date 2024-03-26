// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Button, Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import AirgappedTrialActivationConfirmSvg from 'components/common/svg_images_components/airgapped_trial_activation_confirm_svg';
import ExternalLink from 'components/external_link';

import './air_gapped_modal.scss';

type Props = {
    onClose?: () => void;
}

function AirGappedModal({onClose}: Props) {
    const {formatMessage} = useIntl();
    const airGappedLink = (
        <ExternalLink
            location='start_trial_air_gapped_modal'
            href='https://mattermost.com/trial/'
        >
            {'https://mattermost.com/trial/'}
        </ExternalLink>
    );
    return (
        <Modal
            className={'AirGappedModal'}
            dialogClassName={'AirGappedModal__dialog'}
            show={true}
            id='airGappedModal'
            role='dialog'
            onHide={() => onClose?.()}
        >
            <Modal.Header closeButton={true}>
                <div className='title'>
                    {formatMessage({id: 'air_gapped_modal.title', defaultMessage: 'Request a trial key'})}
                </div>
            </Modal.Header>
            <Modal.Body>
                <div className='body'>
                    <div className='description'>
                        {
                            formatMessage(
                                {
                                    id: 'air_gapped_modal.description',
                                    defaultMessage: 'To start your trial, please visit {link} and request a trial key.',
                                },
                                {
                                    link: airGappedLink,
                                },
                            )
                        }
                    </div>
                    <div className='icon'>
                        <AirgappedTrialActivationConfirmSvg
                            width={256}
                            height={200}
                        />
                    </div>
                </div>
                <div className='buttons'>
                    <Button
                        className='confirm-btn'
                        onClick={() => onClose?.()}
                    >
                        {formatMessage({id: 'air_gapped_modal.close', defaultMessage: 'Close'})}
                    </Button>
                </div>
            </Modal.Body>
        </Modal>
    );
}

export default AirGappedModal;
