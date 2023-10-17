// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {closeModal} from 'actions/views/modals';

import ResultModal from 'components/admin_console/billing/delete_workspace/result_modal';
import LaptopAlertSvg from 'components/common/svg_images_components/laptop_with_warning_symbol_svg';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    onTryAgain?: () => void;
    title?: JSX.Element;
    subtitle?: JSX.Element;
    buttonText?: JSX.Element;
}

export default function StartTrialFormModalResult(props: Props) {
    const dispatch = useDispatch();

    const handleButtonClick = () => {
        props.onTryAgain?.();
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL_RESULT));
    };

    const title = props.title || (
        <FormattedMessage
            defaultMessage={'Please try again'}
            id={'start_trial_form_modal.failureModal.title'}
        />
    );

    const subtitle = (
        <>
            <FormattedMessage
                id={'start_trial_form_modal.failureModal.subtitle'}
                defaultMessage={'There was an issue processing your trial request.'}
            />
            <br/>
            <FormattedMessage
                id={'start_trial_form_modal.failureModal.subtitle2'}
                defaultMessage={'Please try again or contact support.'}
            />
        </>
    );

    const buttonText = props.buttonText || (
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
                    width={135}
                    height={100}
                />
            }
            contactSupportButtonVisible={true}
        />
    );
}
