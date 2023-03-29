// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {DispatchFunc} from 'mattermost-redux/types/actions';

import useGetSubscription from 'components/common/hooks/useGetSubscription';

import {requestCloudTrial, validateWorkspaceBusinessEmail, getCloudLimits} from 'actions/cloud';
import {trackEvent} from 'actions/telemetry_actions';
import {openModal, closeModal} from 'actions/views/modals';

import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';

import RequestBusinessEmailModal from './request_business_email_modal';
import './cloud_start_trial_btn.scss';

export type CloudStartTrialBtnProps = {
    message: string;
    telemetryId: string;
    onClick?: () => void;
    extraClass?: string;
    afterTrialRequest?: () => void;
    email?: string;
    disabled?: boolean;
};

enum TrialLoadStatus {
    NotStarted = 'NOT_STARTED',
    Started = 'STARTED',
    Success = 'SUCCESS',
    Failed = 'FAILED',
    Embargoed = 'EMBARGOED',
}

const TIME_UNTIL_CACHE_PURGE_GUESS = 5000;

const CloudStartTrialButton = ({
    message,
    telemetryId,
    extraClass,
    onClick,
    afterTrialRequest,
    email,
    disabled = false,
}: CloudStartTrialBtnProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const subscription = useGetSubscription();
    const [openBusinessEmailModal, setOpenBusinessEmailModal] = useState(false);
    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);

    const validateBusinessEmailOnLoad = async () => {
        const isValidBusinessEmail = await validateWorkspaceBusinessEmail()();
        if (!isValidBusinessEmail) {
            setOpenBusinessEmailModal(true);
        }
    };

    useEffect(() => {
        validateBusinessEmailOnLoad();
    }, []);

    const requestStartTrial = async (): Promise<TrialLoadStatus> => {
        setLoadStatus(TrialLoadStatus.Started);

        // email is set ONLY from the instance of this component created in the requestBusinessEmail modal.
        // So the flow is the following: If the email of the admin and the
        // email of the CWS customer are not valid, the requestBusinessModal is shown and that component will
        // create this StartCloudTrialBtn passing the email as Truthy, so the requetTrial flow continues normally
        if (openBusinessEmailModal && !email) {
            trackEvent(
                TELEMETRY_CATEGORIES.CLOUD_START_TRIAL_BUTTON,
                'trial_request_attempt_with_no_valid_business_email',
            );
            await dispatch(closeModal(ModalIdentifiers.LEARN_MORE_TRIAL_MODAL));
            openRequestBusinessEmailModal();
            setLoadStatus(TrialLoadStatus.Failed);
            return TrialLoadStatus.Failed;
        }

        const subscriptionUpdated = await dispatch(requestCloudTrial('start_cloud_trial_btn', subscription?.id as string, (email || '')));
        if (!subscriptionUpdated) {
            setLoadStatus(TrialLoadStatus.Failed);
            return TrialLoadStatus.Failed;
        }

        function ensureUpdatedData() {
            // Depending on timing of pods rolling, the webhook may still not get sent.
            // Re-request limits as a just-in-case, but only well after any
            // pods still alive should have either purged cache,
            // updated limits, or be brand new pods that won't be holding onto stale limits
            // We don't need to re-request subscription: the updated value is sent in the
            // request cloud trial response.
            // We don't need to request license: its update process is independent
            // from subscription/limit changes and always happens after pods roll.
            dispatch(getCloudLimits());
        }

        setTimeout(ensureUpdatedData, TIME_UNTIL_CACHE_PURGE_GUESS);
        if (afterTrialRequest) {
            afterTrialRequest();
        }
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

    const openRequestBusinessEmailModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.REQUEST_BUSINESS_EMAIL_MODAL,
            dialogType: RequestBusinessEmailModal,
        }));
    };

    const btnText = (status: TrialLoadStatus): string => {
        switch (status) {
        case TrialLoadStatus.Started:
            return formatMessage({id: 'start_cloud_trial.modal.gettingTrial', defaultMessage: 'Getting Trial...'});
        case TrialLoadStatus.Success:
            return formatMessage({id: 'start_cloud_trial.modal.loaded', defaultMessage: 'Loaded!'});
        case TrialLoadStatus.Failed:
            return formatMessage({id: 'start_cloud_trial.modal.failed', defaultMessage: 'Failed'});
        case TrialLoadStatus.Embargoed:
            return formatMessage({id: 'admin.license.trial-request.embargoed'});
        default:
            return message;
        }
    };
    const startCloudTrial = async () => {
        if (status !== TrialLoadStatus.NotStarted) {
            return;
        }

        const updatedStatus = await requestStartTrial();

        if (updatedStatus !== TrialLoadStatus.Success) {
            return;
        }

        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_START_TRIAL_BUTTON,
            telemetryId,
        );

        // on click will execute whatever action is sent from the invoking place, if nothing is sent, open the trial benefits modal
        if (onClick) {
            onClick();
            return;
        }

        await openTrialBenefitsModal(updatedStatus);
    };

    return (
        <button
            id='start_cloud_trial_btn'
            className={`CloudStartTrialButton ${extraClass}`}
            onClick={startCloudTrial}
            disabled={disabled || status === TrialLoadStatus.Failed}
        >
            {btnText(status)}
        </button>
    );
};

export default CloudStartTrialButton;
