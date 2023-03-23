// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {closeModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import LaptopAlertSvg from 'components/common/svg_images_components/laptop_with_warning_symbol_svg';

import ResultModal from 'components/admin_console/billing/delete_workspace/result_modal';

type Props = {
    onTryAgain?: () => void;
}

export default function StartTrialFormModalResult(props: Props) {
    const dispatch = useDispatch();

    const handleButtonClick = () => {
        props.onTryAgain?.();
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL_RESULT));
    };

    const title = (
        <FormattedMessage
            defaultMessage={'Please try again'}
            id={'start_trial_form_modal.failureModal.title'}
        />
    );

    const subtitle = (
        <FormattedMessage
            id={'start_trial_form_modal.failureModal.subtitle'}
            defaultMessage={'There was in issue processing your trial request. Please try again or contact support.'}
        />
    );

    const buttonText = (
        <FormattedMessage
            id='admin.billing.deleteWorkspace.failureModal.buttonText'
            defaultMessage={'Try Again'}
        />
    );

    return (
        <ResultModal
            primaryButtonText={buttonText}
            primaryButtonHandler={handleButtonClick}
            onHide={handleButtonClick}
            identifier={ModalIdentifiers.START_TRIAL_FORM_MODAL_RESULT}
            subtitle={subtitle}
            title={title}
            ignoreExit={false}
            type='small'
            resultType='failure'
            icon={
                <LaptopAlertSvg
                    width={444}
                    height={313}
                />
            }
            contactSupportButtonVisible={true}
        />
    );
}
