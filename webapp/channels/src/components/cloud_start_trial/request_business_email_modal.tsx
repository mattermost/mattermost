// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {debounce} from 'lodash';

import {GenericModal} from '@mattermost/components';

import type {DispatchFunc} from 'mattermost-redux/types/actions';
import {isEmail} from 'mattermost-redux/utils/helpers';

import {validateBusinessEmail} from 'actions/cloud';
import {trackEvent} from 'actions/telemetry_actions';
import {closeModal} from 'actions/views/modals';

import ExternalLink from 'components/external_link';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {ItemStatus, TELEMETRY_CATEGORIES, ModalIdentifiers, LicenseLinks, AboutLinks} from 'utils/constants';

import StartCloudTrialBtn from './cloud_start_trial_btn';
import InputBusinessEmail from './input_business_email';

import './request_business_email_modal.scss';

type Props = {
    onClose?: () => void;
    onExited: () => void;
}

const RequestBusinessEmailModal = (
    {
        onClose,
        onExited,
    }: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const [email, setEmail] = useState<string>('');
    const [customInputLabel, setCustomInputLabel] = useState<CustomMessageInputType>(null);
    const [trialBtnDisabled, setTrialBtnDisabled] = useState<boolean>(true);

    useEffect(() => {
        trackEvent(
            TELEMETRY_CATEGORIES.REQUEST_BUSINESS_EMAIL,
            'request_business_email',
        );
    }, []);

    const handleOnClose = useCallback(() => {
        if (onClose) {
            onClose();
        }

        onExited();
    }, [onClose, onExited]);

    const handleEmailValues = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const email = e.target.value;
        setEmail(email.trim().toLowerCase());

        validateEmail(email);
    }, []);

    const validateEmail = useCallback(debounce(async (email: string) => {
        // no value set, no validation and clean the custom input label
        if (!email) {
            setTrialBtnDisabled(true);
            setCustomInputLabel(null);
            return;
        }

        // function isEmail aready handle empty / null value
        if (!isEmail(email)) {
            const errMsg = formatMessage({id: 'request_business_email_modal.invalidEmail', defaultMessage: 'This doesn\'t look like a valid email'});
            setCustomInputLabel({type: ItemStatus.WARNING, value: errMsg});
            setTrialBtnDisabled(true);
            return;
        }

        // go and validate the email against the validateBusinessEmail endpoint
        const isValidBusinessEmail = await validateBusinessEmail(email)();
        if (!isValidBusinessEmail) {
            const errMsg = formatMessage({id: 'request_business_email_modal.not_business_email', defaultMessage: 'This doesn\'t look like a business email'});
            setCustomInputLabel({type: ItemStatus.ERROR, value: errMsg});
            setTrialBtnDisabled(true);
            return;
        }

        // if it is a valid business email, proceed, enable the start trial button and notify the user about the email is valid
        const okMsg = formatMessage({id: 'request_business_email_modal.valid_business_email', defaultMessage: 'This is a valid email'});
        setCustomInputLabel({type: ItemStatus.SUCCESS, value: okMsg});
        setTrialBtnDisabled(false);
    }, 250), []);

    // this function will be executed after successfull trial request, closing this request business email modal
    const closeMeAfterSuccessTrialReq = async () => {
        await dispatch(closeModal(ModalIdentifiers.REQUEST_BUSINESS_EMAIL_MODAL));
    };

    return (
        <GenericModal
            className='RequestBusinessEmailModal'
            id='RequestBusinessEmailModal'
            onExited={handleOnClose}
        >
            <div className='start-trial-email-title'>
                <FormattedMessage
                    id='start_cloud_trial.modal.enter_trial_email.title'
                    defaultMessage='Enter an email to start your trial'
                />
            </div>
            <div className='start-trial-email-description'>
                <FormattedMessage
                    id='start_cloud_trial.modal.enter_trial_email.description'
                    defaultMessage='Start a trial and enter a business email to get started. '
                />
            </div>
            <div className='start-trial-email-input'>
                <InputBusinessEmail
                    email={email}
                    handleEmailValues={handleEmailValues}
                    customInputLabel={customInputLabel}
                />
            </div>
            <div className='start-trial-email-disclaimer'>
                <FormattedMessage
                    id='request_business_email.start_trial.modal.disclaimer'
                    defaultMessage='By selecting <highlight>“Start trial”</highlight>, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>privacy policy</linkPrivacy> and receiving product emails.'
                    values={{
                        highlight: (msg: React.ReactNode) => (
                            <strong>
                                {msg}
                            </strong>
                        ),
                        linkEvaluation: (msg: React.ReactNode) => (
                            <ExternalLink
                                href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                location='request_business_email_modal'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkPrivacy: (msg: React.ReactNode) => (
                            <ExternalLink
                                href={AboutLinks.PRIVACY_POLICY}
                                location='request_business_email_modal'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </div>
            <div className='start-trial-button'>
                <StartCloudTrialBtn
                    message={formatMessage({id: 'cloud.startTrial.modal.btn', defaultMessage: 'Start trial'})}
                    telemetryId='request_business_email_modal'
                    disabled={trialBtnDisabled}
                    email={email}
                    afterTrialRequest={closeMeAfterSuccessTrialReq}
                />
            </div>
        </GenericModal>
    );
};

export default RequestBusinessEmailModal;
