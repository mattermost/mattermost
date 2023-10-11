// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {CSSTransition} from 'react-transition-group';
import styled from 'styled-components';

import type {GlobalState} from '@mattermost/types/store';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import CloudStartTrialButton from 'components/cloud_start_trial/cloud_start_trial_btn';
import ExternalLink from 'components/external_link';
import StartTrialBtn from 'components/learn_more_trial_modal/start_trial_btn';

import completedImg from 'images/completed.svg';
import {AboutLinks, LicenseLinks, LicenseSkus} from 'utils/constants';

const CompletedWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 26px 24px 0 24px;
    margin: auto;
    text-align: center;
    word-break: break-word;
    width: 100%;
    height: 500px;

    &.fade-enter {
        transform: scale(0);
    }
    &.fade-enter-active {
        transform: scale(1);
    }
    &.fade-enter-done {
        transform: scale(1);
    }
    &.fade-exit {
        transform: scale(1);
    }
    &.fade-exit-active {
        transform: scale(1);
    }
    &.fade-exit-done {
        transform: scale(1);
    }
    .start-trial-btn, .got-it-button {
        padding: 13px 20px;
        background: var(--button-bg);
        border-radius: 4px;
        color: var(--sidebar-text);
        border: none;
        font-weight: bold;
        margin-top: 15px;
        min-height: 40px;
        &:hover {
            background: var(--button-bg) !important;
            color: var(--sidebar-text) !important;
        }
    }

    h2 {
        font-size: 20px;
        margin: 0 0 10px;
        font-weight: 600;
    }

    .start-trial-text, .completed-subtitle {
        font-size: 14px !important;
        color: rgba(var(--center-channel-color-rgb), 0.72);
        line-height: 20px;
    }

    .completed-subtitle {
        margin-top: 5px;
    }

    .disclaimer, .download-apps {
        width: 90%;
        margin-top: 15px;
        color: rgba(var(--center-channel-color-rgb), 0.72);
        font-family: "Open Sans";
        font-style: normal;
        font-weight: normal;
        line-height: 16px;
    }

    .disclaimer {
        text-align: left;
        margin-top: auto;
        font-size: 11px;
    }

    .download-apps {
        margin-top: 24px;
        width: 200px;
        font-size: 12px;
    }

    .style-link {
        border: none;
        background: none !important;
        color: var(--button-bg) !important;
    }

    .no-thanks-link {
        display: inline-block;
        min-width: fit-content;
        margin-top: 18px;
        font-weight: 600;
        font-size: 14px;
        line-height: 20px;
        &:hover {
            text-decoration: underline;
        }
    }
`;

interface Props {
    dismissAction: () => void;
    isCurrentUserSystemAdmin: boolean;
    isFirstAdmin: boolean;
}

const Completed = (props: Props): JSX.Element => {
    const {dismissAction} = props;

    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const license = useSelector(getLicense);
    const isPrevLicensed = prevTrialLicense?.IsLicensed;
    const isCurrentLicensed = license?.IsLicensed;

    // Cloud conditions
    const subscription = useSelector((state: GlobalState) => state.entities.cloud.subscription);
    const isCloud = license?.Cloud === 'true';
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const hadPrevCloudTrial = subscription?.is_free_trial === 'false' && subscription?.trial_end_at > 0;
    const isPaidSubscription = isCloud && license?.SkuShortName !== LicenseSkus.Starter && !isFreeTrial;

    // Show this CTA if the instance is currently not licensed and has never had a trial license loaded before
    // also check that the user is a system admin (this after the onboarding task list is shown to all users)
    const selfHostedTrialCondition = (isCurrentLicensed === 'false' && isPrevLicensed === 'false') &&
    (props.isCurrentUserSystemAdmin || props.isFirstAdmin);

    // if Cloud, show if not in trial and had never been on trial
    const cloudTrialCondition = isCloud && !isFreeTrial && !hadPrevCloudTrial && !isPaidSubscription;

    const showStartTrialBtn = selfHostedTrialCondition || cloudTrialCondition;

    const {formatMessage} = useIntl();

    return (
        <>
            <CSSTransition
                in={true}
                timeout={150}
                classNames='fade'
            >
                <CompletedWrapper>
                    <img
                        src={completedImg}
                        alt={'completed tasks image'}
                    />
                    <h2>
                        <FormattedMessage
                            id={'onboardingTask.checklist.completed_title'}
                            defaultMessage='Well done. You’ve completed all of the tasks!'
                        />
                    </h2>
                    <span className='completed-subtitle'>
                        <FormattedMessage
                            id={'onboardingTask.checklist.completed_subtitle'}
                            defaultMessage='We hope Mattermost is more familiar now.'
                        />
                    </span>

                    {showStartTrialBtn ? (
                        <>
                            <span className='start-trial-text'>
                                <FormattedMessage
                                    id='onboardingTask.checklist.higher_security_features'
                                    defaultMessage='Interested in our higher-security features?'
                                /> <br/>
                                <FormattedMessage
                                    id='onboardingTask.checklist.start_enterprise_now'
                                    defaultMessage='Start your free Enterprise trial now!'
                                />
                            </span>
                            {isCloud ? (
                                <CloudStartTrialButton
                                    message={formatMessage({id: 'trial_btn.free.tryFreeFor30Days', defaultMessage: 'Start trial'})}
                                    telemetryId={'start_cloud_trial_after_completing_steps'}
                                    extraClass={'btn btn-primary'}
                                    afterTrialRequest={dismissAction}
                                />
                            ) : (
                                <StartTrialBtn
                                    message={formatMessage({id: 'start_trial.modal_btn.start_free_trial', defaultMessage: 'Start free 30-day trial'})}
                                    telemetryId='start_trial_from_onboarding_completed_task'
                                    onClick={dismissAction}
                                />
                            )}
                            <button
                                onClick={dismissAction}
                                className={'no-thanks-link style-link'}
                            >
                                <FormattedMessage
                                    id={'onboardingTask.checklist.no_thanks'}
                                    defaultMessage='No, thanks'
                                />
                            </button>
                        </>

                    ) : (
                        <button
                            onClick={dismissAction}
                            className='got-it-button'
                        >
                            <FormattedMessage
                                id={'collapsed_reply_threads_modal.confirm'}
                                defaultMessage='Got it'
                            />
                        </button>
                    )}
                    <div className='download-apps'>
                        <span>
                            <FormattedMessage
                                id='onboardingTask.checklist.downloads'
                                defaultMessage='Now that you’re all set up, <link>download our apps.</link>!'
                                values={{
                                    link: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            location='onboarding_tasklist_completed'
                                            href='https://mattermost.com/download#desktop'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                }}
                            />
                        </span>
                    </div>
                    {showStartTrialBtn && <div className='disclaimer'>
                        <span>
                            <FormattedMessage
                                id='onboardingTask.checklist.disclaimer'
                                defaultMessage='By clicking “Start trial”, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>privacy policy</linkPrivacy> and receiving product emails.'
                                values={{
                                    linkEvaluation: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                            location='onboarding_tasklist_completed'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkPrivacy: (msg: React.ReactNode) => (
                                        <ExternalLink
                                            href={AboutLinks.PRIVACY_POLICY}
                                            location='onboarding_tasklist_completed'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                }}
                            />
                        </span>
                    </div>}
                </CompletedWrapper>
            </CSSTransition>
        </>
    );
};

export default Completed;
