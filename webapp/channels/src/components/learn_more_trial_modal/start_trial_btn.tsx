// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import useOpenStartTrialFormModal from 'components/common/hooks/useOpenStartTrialFormModal';

import './start_trial_btn.scss';

export type StartTrialBtnProps = {
    message: string;
    telemetryId: string;
    onClick?: () => void;
    handleEmbargoError?: () => void;
    btnClass?: string;
    renderAsButton?: boolean;
    disabled?: boolean;
    trackingPage?: string;
};

const StartTrialBtn = ({
    btnClass,
    onClick,
    disabled = false,
    renderAsButton = false,
}: StartTrialBtnProps) => {
    const {formatMessage} = useIntl();
    const openTrialForm = useOpenStartTrialFormModal();
    const startTrial = async () => {
        // reading status from here instead of normal flow because
        // by the time the function needs the updated value from requestLicense,
        // it will be too late to wait for the render cycle to happen again
        // to close over the updated value
        openTrialForm();

        // on click will execute whatever action is sent from the invoking place, if nothing is sent, open the trial benefits modal
        if (onClick) {
            onClick();
        }
    };

    const id = 'start_trial_btn';

    const btnText = formatMessage({id: 'admin.ldap_feature_discovery.call_to_action.primary', defaultMessage: 'Start trial'});

    return renderAsButton ? (
        <button
            id={id}
            className={btnClass}
            onClick={startTrial}
            disabled={disabled}
        >
            {btnText}
        </button>
    ) : (
        <a
            id={id}
            className='btn btn-secondary'
            onClick={startTrial}
        >
            {btnText}
        </a>
    );
};

export default StartTrialBtn;
