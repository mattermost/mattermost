// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {closeModal} from 'actions/views/modals';

import ExternalLink from 'components/external_link';

import accessProblemImage from 'images/air_gapped_contact_us_image.png';
import {ModalIdentifiers} from 'utils/constants';

import './style.scss';

function AirGappedContactSalesModal() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const handleOnClose = useCallback(() => {
        dispatch(closeModal(ModalIdentifiers.AIR_GAPPED_CONTACT_SALES));
    }, []);

    return (
        <GenericModal
            id='air-gapped-contact-sales-modal'
            className='air-gapped-contact-sales-modal'
            modalHeaderText={formatMessage({id: 'air_gapped_contact_sales_modal.title', defaultMessage: 'Looks like you do not have access to the internet'})}
            compassDesign={true}
            onExited={handleOnClose}
        >
            <div className='air-gapped-contact-sales-modal-body'>
                <div className='body-text'>
                    {formatMessage({id: 'air_gapped_contact_sales_modal.body', defaultMessage: 'Please access the link below to contact sales.'})}
                </div>
                <div className='contact-sales-link'>
                    <ExternalLink
                        location='air_gapped_contact_sales_modal'
                        href='https://mattermost.com/contact-sales/'
                    >
                        {'https://mattermost.com/contact-sales/'}
                    </ExternalLink>
                </div>
                <div className='image'>
                    <img
                        aria-hidden='true'
                        src={accessProblemImage}
                    />
                </div>
            </div>
        </GenericModal>
    );
}

export default AirGappedContactSalesModal;
