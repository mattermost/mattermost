// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {DispatchFunc} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import {isModalOpen} from 'selectors/views/modals';

import GenericModal from 'components/generic_modal';

import {ModalIdentifiers} from 'utils/constants';

import {closeModal} from 'actions/views/modals';

import './ee_license_modal.scss';

type Props = {
    onClose?: () => void;
}

const EELicenseModal: React.FC<Props> = (props: Props): JSX.Element | null => {
    const dispatch = useDispatch<DispatchFunc>();

    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.ENTERPRISE_EDITION_LICENSE));
    if (!show) {
        return null;
    }

    const handleOnClose = () => {
        if (props.onClose) {
            props.onClose();
        }
        dispatch(closeModal(ModalIdentifiers.ENTERPRISE_EDITION_LICENSE));
    };

    // Note: DO NOT LOCALISE THESE STRINGS. Legally we can not since the license is in English.
    return (
        <GenericModal
            className={'EELicenseModal'}
            show={show}
            id='EELicenseModal'
            onExited={handleOnClose}
        >
            <>
                <div
                    className='title'
                >
                    {'Enterprise Edition License:'}
                </div>
                <div className='enterprise-license-text'>
                    <div>
                        <p>{'The Mattermost Enterprise Edition (EE) license (the “EE License”)'}</p>
                        <p>{'Copyright (c) 2016-present Mattermost, Inc.'}</p>
                        <p>{'The subscription-only features of the Mattermost Enterprise Edition software and associated documentation files (the "Software") may only be used if you (and any entity that you represent) (i) have agreed to, and are in compliance with, the Mattermost Subscription Terms of Service, available at https://mattermost.com/enterprise-edition-terms/ (the “EE Terms”), and (ii) otherwise have a valid Mattermost Enterprise Edition subscription for the correct features, number of user seats and instances of Mattermost Enterprise Edition that you are running, accessing, or using.  You may, however, utilize the free version of the Software (with several features not enabled) under this license without a license key or subscription provided that you otherwise comply with the terms and conditions of this Agreement. Subject to the foregoing, except as explicitly permitted in the EE Terms, it is forbidden to copy, merge, modify, publish, distribute, sublicense, stream, perform, display, create derivative works of and/or sell the Software in either source or executable form without written agreement from Mattermost.  Notwithstanding anything to the contrary, free versions of the Software are provided “AS-IS” without indemnification, support, or warranties of any kind, expressed or implied. You assume all risk associated with any use of free versions of the Software.'}</p>
                        <p>{'EXCEPT AS OTHERWISE SET FORTH IN A BINDING WRITTEN AGREEMENT BETWEEN YOU AND MATTERMOST, THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.'}</p>
                    </div>
                </div>
                <div className='content-footer'>
                    <button
                        onClick={handleOnClose}
                        className='btn btn-primary'
                    >
                        {'Close'}
                    </button>
                </div>
            </>
        </GenericModal>
    );
};

export default EELicenseModal;
