// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {useIntl} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {EmbargoedEntityTrialError} from 'components/admin_console/license_settings/trial_banner/trial_banner';

import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getLicenseConfig} from 'mattermost-redux/actions/general';

import {GlobalState} from 'types/store';

import {requestTrialLicense} from 'actions/admin_actions';
import {trackEvent} from 'actions/telemetry_actions';

import {openModal} from 'actions/views/modals';

import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

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

enum TrialLoadStatus {
    NotStarted = 'NOT_STARTED',
    Started = 'STARTED',
    Success = 'SUCCESS',
    Failed = 'FAILED',
    Embargoed = 'EMBARGOED',
}

const StartTrialBtn = ({
    message,
    btnClass,
    telemetryId,
    onClick,
    handleEmbargoError,
    disabled = false,
    renderAsButton = false,
    trackingPage = 'licensing',
}: StartTrialBtnProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const stats = useSelector((state: GlobalState) => state.entities.admin.analytics);

    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);

    const requestLicense = async (): Promise<TrialLoadStatus> => {
        setLoadStatus(TrialLoadStatus.Started);
        let users = 0;
        if (stats && (typeof stats.TOTAL_USERS === 'number')) {
            users = stats.TOTAL_USERS;
        }
        const requestedUsers = Math.max(users, 30);
        const {error, data} = await dispatch(requestTrialLicense(requestedUsers, true, true, trackingPage));
        if (error) {
            if (typeof data?.status !== 'undefined' && data.status === 451) {
                setLoadStatus(TrialLoadStatus.Embargoed);
                if (typeof handleEmbargoError === 'function') {
                    handleEmbargoError();
                }
                return TrialLoadStatus.Embargoed;
            }
            setLoadStatus(TrialLoadStatus.Failed);
            return TrialLoadStatus.Failed;
        }

        await dispatch(getLicenseConfig());
        setLoadStatus(TrialLoadStatus.Success);
        return TrialLoadStatus.Success;
    };

    const openTrialBenefitsModal = async (status: TrialLoadStatus) => {
        // Only open the benefits modal if the trial request succeeded
        if (status !== TrialLoadStatus.Success) {
            return;
        }
        await dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
            dialogProps: {trialJustStarted: true},
        }));
    };

    const btnText = (status: TrialLoadStatus): string => {
        switch (status) {
        case TrialLoadStatus.Started:
            return formatMessage({id: 'start_trial.modal.gettingTrial', defaultMessage: 'Getting Trial...'});
        case TrialLoadStatus.Success:
            return formatMessage({id: 'start_trial.modal.loaded', defaultMessage: 'Loaded!'});
        case TrialLoadStatus.Failed:
            return formatMessage({id: 'start_trial.modal.failed', defaultMessage: 'Failed'});
        case TrialLoadStatus.Embargoed:
            return formatMessage({id: 'admin.license.trial-request.embargoed'});
        default:
            return message;
        }
    };
    const startTrial = async () => {
        // reading status from here instead of normal flow because
        // by the time the function needs the updated value from requestLicense,
        // it will be too late to wait for the render cycle to happen again
        // to close over the updated value
        const updatedStatus = await requestLicense();

        if (updatedStatus !== TrialLoadStatus.Success) {
            return;
        }

        trackEvent(
            TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL,
            telemetryId,
        );

        // on click will execute whatever action is sent from the invoking place, if nothing is sent, open the trial benefits modal
        if (onClick) {
            onClick();
            return;
        }

        await openTrialBenefitsModal(updatedStatus);
    };

    if (status === TrialLoadStatus.Embargoed) {
        return (
            <div className='StartTrialBtn embargoed'>
                <EmbargoedEntityTrialError/>
            </div>
        );
    }

    const id = 'start_trial_btn';

    return renderAsButton ? (
        <button
            id={id}
            className={btnClass}
            onClick={startTrial}
            disabled={disabled}
        >
            {btnText(status)}
        </button>
    ) : (
        <a
            id={id}
            className='StartTrialBtn start-trial-btn'
            onClick={startTrial}
        >
            {btnText(status)}
        </a>
    );
};

export default StartTrialBtn;
