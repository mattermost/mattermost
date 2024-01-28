// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import AlertSvg from 'components/common/svg_images_components/alert_svg';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './confirm_license_removal_modal.scss';

type Props = {
    currentLicenseSKU: string;
    onExited?: () => void;
    handleRemove?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
}

const ConfirmLicenseRemovalModal: React.FC<Props> = (props: Props): JSX.Element | null => {
    const dispatch = useDispatch();

    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.CONFIRM_LICENSE_REMOVAL));
    if (!show) {
        return null;
    }

    const handleOnClose = () => {
        if (props.onExited) {
            props.onExited();
        }
        dispatch(closeModal(ModalIdentifiers.CONFIRM_LICENSE_REMOVAL));
    };

    const handleRemoval = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (props.handleRemove) {
            props.handleRemove(e);
        }
        dispatch(closeModal(ModalIdentifiers.CONFIRM_LICENSE_REMOVAL));
    };

    return (
        <GenericModal
            compassDesign={true}
            className={'ConfirmLicenseRemovalModal'}
            show={show}
            id='ConfirmLicenseRemovalModal'
            onExited={handleOnClose}
        >
            <>
                <div className='content-body'>
                    <div className='alert-svg'>
                        <AlertSvg
                            width={150}
                            height={150}
                        />
                    </div>
                    <div className='title'>
                        <FormattedMessage
                            id='admin.license.confirm-license-removal.title'
                            defaultMessage='Are you sure?'
                        />
                    </div>
                    <div className='subtitle'>
                        <FormattedMessage
                            id='admin.license.confirm-license-removal.subtitle'
                            defaultMessage='Removing the license will downgrade your server from {currentSKU} to Free. You may lose information. '
                            values={{currentSKU: props.currentLicenseSKU}}
                        />
                    </div>
                </div>
                <div className='content-footer'>
                    <button
                        onClick={handleOnClose}
                        className='btn light-blue-btn'
                        id='cancel-removal'
                    >
                        <FormattedMessage
                            id='admin.license.confirm-license-removal.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        onClick={handleRemoval}
                        className='btn btn-primary'
                        id='confirm-removal'
                    >
                        <FormattedMessage
                            id='admin.license.confirm-license-removal.confirm'
                            defaultMessage='Confirm'
                        />
                    </button>
                </div>
            </>
        </GenericModal>
    );
};

export default ConfirmLicenseRemovalModal;
