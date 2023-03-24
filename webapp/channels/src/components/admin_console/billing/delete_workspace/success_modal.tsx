// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';

import {MattermostLink, ModalIdentifiers} from 'utils/constants';

import ResultModal from './result_modal';
import './success_modal.scss';

export default function DeleteWorkspaceSuccessModal() {
    const handleButtonClick = () => {
        window.open(MattermostLink, '_blank');
    };

    const title = (
        <FormattedMessage
            defaultMessage={'Your workspace has been deleted'}
            id={'admin.billing.deleteWorkspace.successModal.title'}
        />
    );

    const subtitle = (
        <FormattedMessage
            id={'admin.billing.deleteWorkspace.successModal.subtitle'}
            defaultMessage={'Your workspace has now been deleted. Thank you for being a customer.'}
        />
    );

    const buttonText = (
        <FormattedMessage
            id='delete_success_modal.button_text'
            defaultMessage={'Go to mattermost.com'}
        />
    );

    return (
        <ResultModal
            primaryButtonText={buttonText}
            primaryButtonHandler={handleButtonClick}
            identifier={ModalIdentifiers.DELETE_WORKSPACE_RESULT}
            subtitle={subtitle}
            title={title}
            ignoreExit={true}
            resultType='success'
            icon={
                <PaymentSuccessStandardSvg
                    width={444}
                    height={313}
                />
            }
            contactSupportButtonVisible={false}
        />
    );
}
