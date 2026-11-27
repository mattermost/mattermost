// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CellphoneIcon} from '@mattermost/compass-icons/components';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import MobileQRLoginModal from 'components/mobile_qr_login_modal';

import {ModalIdentifiers} from 'utils/constants';

export default function UserAccountMobileQRLoginMenuItem() {
    const dispatch = useDispatch();

    function handleClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.MOBILE_QR_LOGIN,
            dialogType: MobileQRLoginModal,
        }));
    }

    return (
        <Menu.Item
            leadingElement={
                <CellphoneIcon
                    size={18}
                    aria-hidden='true'
                />
            }
            labels={
                <FormattedMessage
                    id='userAccountMenu.mobileQRLoginMenuItem.label'
                    defaultMessage='Sign in on mobile'
                />
            }
            aria-haspopup={true}
            onClick={handleClick}
        />
    );
}
