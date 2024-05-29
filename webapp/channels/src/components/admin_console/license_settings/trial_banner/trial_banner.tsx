// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getBool as getBoolPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import AlertBanner from 'components/alert_banner';
import withOpenStartTrialFormModal from 'components/common/hocs/cloud/with_open_start_trial_form_modal';
import type {TelemetryProps} from 'components/common/hooks/useOpenPricingModal';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {AboutLinks, LicenseLinks, Preferences, Unique} from 'utils/constants';
import {format} from 'utils/markdown';

import type {GlobalState} from 'types/store';

interface TrialBannerProps {
    isDisabled: boolean;
    gettingTrialError: string | null;
    gettingTrialResponseCode: number | null;
    gettingTrial: boolean;
    enterpriseReady: boolean;
    upgradingPercentage: number;
    handleUpgrade: () => Promise<void>;
    upgradeError: string | null;
    restartError: string | null;
    openTrialForm?: (telemetryProps?: TelemetryProps) => void;

    handleRestart: () => Promise<void>;

    openEEModal: () => void;

    restarting: boolean;
}

export const EmbargoedEntityTrialError = () => {
    return (
        <FormattedMessage
            id='admin.license.trial-request.embargoed'
            defaultMessage='We were unable to process the request due to limitations for embargoed countries. <link>Learn more in our documentation</link>, or reach out to legal@mattermost.com for questions around export limitations.'
            values={{
                link: (text: string) => (
                    <ExternalLink
                        location='trial_banner'
                        href={LicenseLinks.EMBARGOED_COUNTRIES}
                    >
                        {text}
                    </ExternalLink>
                ),
            }}
        />
    );
};

enum TrialLoadStatus {
    NotStarted = 'NOT_STARTED',
    Started = 'STARTED',
    Success = 'SUCCESS',
    Failed = 'FAILED',
    Embargoed = 'EMBARGOED',
}

const TrialBanner = ({
    isDisabled,
    gettingTrialError,
    gettingTrialResponseCode,
    gettingTrial,
    enterpriseReady,
    upgradingPercentage,
    handleUpgrade,
    upgradeError,
    restartError,
    handleRestart,
    restarting,
    openEEModal,
    openTrialForm,
}: TrialBannerProps) => {
    let trialButton;
    let upgradeTermsMessage;
    let content;
    let gettingTrialErrorMsg;

    const {formatMessage} = useIntl();

    const restartedAfterUpgradePrefs = useSelector<GlobalState>((state) => getBoolPreference(state, Preferences.UNIQUE, Unique.REQUEST_TRIAL_AFTER_SERVER_UPGRADE));
    const clickedUpgradeAndTrialBtn = useSelector<GlobalState>((state) => getBoolPreference(state, Preferences.UNIQUE, Unique.CLICKED_UPGRADE_AND_TRIAL_BTN));

    const userId = useSelector((state: GlobalState) => getCurrentUserId(state));

    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);

    const dispatch = useDispatch();

    const btnText = (status: TrialLoadStatus) => {
        switch (status) {
        case TrialLoadStatus.Started:
            return formatMessage({id: 'start_trial.modal.gettingTrial', defaultMessage: 'Getting Trial...'});
        case TrialLoadStatus.Success:
            return formatMessage({id: 'start_trial.modal.loaded', defaultMessage: 'Loaded!'});
        case TrialLoadStatus.Failed:
            return formatMessage({id: 'start_trial.modal.failed', defaultMessage: 'Failed'});
        case TrialLoadStatus.Embargoed:
            return formatMessage<ReactNode>(
                {
                    id: 'admin.license.trial-request.embargoed',
                    defaultMessage: 'We were unable to process the request due to limitations for embargoed countries. <link>Learn more in our documentation</link>, or reach out to legal@mattermost.com for questions around export limitations.',
                },
                {
                    link: (text: string) => (
                        <ExternalLink
                            location='trial_banner'
                            href={LicenseLinks.EMBARGOED_COUNTRIES}
                        >
                            {text}
                        </ExternalLink>
                    ),
                },
            );
        default:
            return formatMessage({id: 'admin.license.trial-request.startTrial', defaultMessage: 'Start trial'});
        }
    };

    const handleRequestLicense = () => {
        if (openTrialForm) {
            openTrialForm({trackingLocation: 'license_settings.trial_banner'});
        }
    };

    useEffect(() => {
        async function savePrefsAndRequestTrial() {
            await savePrefsRestartedAfterUpgrade();
            handleRestart();
        }
        if (upgradingPercentage === 100 && clickedUpgradeAndTrialBtn) {
            if (!restarting) {
                savePrefsAndRequestTrial();
            }
        }
    }, [upgradingPercentage, clickedUpgradeAndTrialBtn]);

    useEffect(() => {
        if (gettingTrial && !gettingTrialError && gettingTrialResponseCode !== 200) {
            setLoadStatus(TrialLoadStatus.Started);
        } else if (gettingTrialError) {
            setLoadStatus(TrialLoadStatus.Failed);
        } else if (gettingTrialResponseCode === 451) {
            setLoadStatus(TrialLoadStatus.Embargoed);
        }
    }, [gettingTrial, gettingTrialError, gettingTrialResponseCode]);

    useEffect(() => {
        // validating the percentage in 0 we make sure to only remove the prefs value on component load after restart
        if (restartedAfterUpgradePrefs && clickedUpgradeAndTrialBtn && upgradingPercentage === 0) {
            // remove the values from the preferences
            const category = Preferences.UNIQUE;
            const reqLicense = Unique.REQUEST_TRIAL_AFTER_SERVER_UPGRADE;
            const clickedBtn = Unique.CLICKED_UPGRADE_AND_TRIAL_BTN;
            dispatch(savePreferences(userId, [{category, name: reqLicense, user_id: userId, value: ''}, {category, name: clickedBtn, user_id: userId, value: ''}]));

            handleRequestLicense();
        }
    }, [restartedAfterUpgradePrefs, clickedUpgradeAndTrialBtn]);

    const onHandleUpgrade = () => {
        if (!handleUpgrade) {
            return;
        }
        handleUpgrade();
        const category = Preferences.UNIQUE;
        const name = Unique.CLICKED_UPGRADE_AND_TRIAL_BTN;
        dispatch(savePreferences(userId, [{category, name, user_id: userId, value: 'true'}]));
    };

    const savePrefsRestartedAfterUpgrade = () => {
        // save in the preferences that this customer wanted to request trial just after the upgrade
        const category = Preferences.UNIQUE;
        const name = Unique.REQUEST_TRIAL_AFTER_SERVER_UPGRADE;
        dispatch(savePreferences(userId, [{category, name, user_id: userId, value: 'true'}]));
    };

    const eeModalTerms = (
        <a
            role='button'
            onClick={openEEModal}
        >
            <FormattedMarkdownMessage
                id='admin.license.enterprise.upgrade.eeLicenseLink'
                defaultMessage='Enterprise Edition License'
            />
        </a>
    );
    if (enterpriseReady && !restartedAfterUpgradePrefs) {
        if (gettingTrialError) {
            gettingTrialErrorMsg =
                gettingTrialResponseCode === 451 ? (
                    <div className='trial-error'>
                        <EmbargoedEntityTrialError/>
                    </div>
                ) : (
                    <p className='trial-error'>
                        <FormattedMessage
                            id='admin.trial_banner.trial-request.error'
                            defaultMessage='Trial license could not be retrieved. Visit <link>{trialInfoLink}</link> to request a license.'
                            values={{
                                link: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        location='trial_banner'
                                        href={LicenseLinks.TRIAL_INFO_LINK}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                trialInfoLink: LicenseLinks.TRIAL_INFO_LINK,
                            }}
                        />
                    </p>
                );
        }
        trialButton = (
            <button
                type='button'
                className='btn btn-primary'
                onClick={handleRequestLicense}
                disabled={isDisabled || gettingTrialError !== null || gettingTrialResponseCode === 451}
            >
                {btnText(status)}
            </button>
        );
        content = (
            <>
                <FormattedMessage
                    id='admin.license.trial-request.title'
                    defaultMessage='Experience Mattermost Enterprise Edition for free for the next 30 days. No obligation to buy or credit card required. '
                />
                <FormattedMessage
                    id='admin.license.trial-request.accept-terms'
                    defaultMessage='By clicking <strong>Start trial</strong>, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>Privacy Policy</linkPrivacy>, and receiving product emails.'
                    values={{
                        strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                        linkEvaluation: (msg: React.ReactNode) => (
                            <ExternalLink
                                href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                location='trial_banner'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkPrivacy: (msg: React.ReactNode) => (
                            <ExternalLink
                                href={AboutLinks.PRIVACY_POLICY}
                                location='trial_banner'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            </>
        );
        upgradeTermsMessage = null;
    } else {
        gettingTrialErrorMsg = null;
        trialButton = (
            <button
                type='button'
                onClick={onHandleUpgrade}
                className='btn btn-primary'
            >
                <LoadingWrapper
                    loading={upgradingPercentage > 0}
                    text={upgradingPercentage === 100 && restarting ? (
                        <FormattedMessage
                            id='admin.license.enterprise.restarting'
                            defaultMessage='Restarting'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.license.enterprise.upgrading'
                            defaultMessage='Upgrading {percentage}%'
                            values={{percentage: upgradingPercentage}}
                        />)}
                >
                    <FormattedMessage
                        id='admin.license.trialUpgradeAndRequest.submit'
                        defaultMessage='Upgrade Server And Start trial'
                    />
                </LoadingWrapper>
            </button>
        );

        content = (
            <>
                <FormattedMessage
                    id='admin.license.upgrade-and-trial-request.title'
                    defaultMessage='Upgrade to Enterprise Edition and Experience Mattermost Enterprise Edition for free for the next 30 days. No obligation to buy or credit card required. '
                />
            </>
        );

        upgradeTermsMessage = (
            <>
                <p className='upgrade-legal-terms'>
                    <FormattedMessage
                        id='admin.license.upgrade-and-trial-request.accept-terms-initial-part'
                        defaultMessage='By selecting <strong>Upgrade Server And Start trial</strong>, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>Privacy Policy</linkPrivacy>, and receiving product emails. '
                        values={{
                            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                            linkEvaluation: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                    location='trial_banner'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkPrivacy: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={AboutLinks.PRIVACY_POLICY}
                                    location='trial_banner'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                    <FormattedMessage
                        id='admin.license.upgrade-and-trial-request.accept-terms-final-part'
                        defaultMessage='Also, I agree to the terms of the Mattermost {eeModalTerms}. Upgrading will download the binary and update your Team Edition instance.'
                        values={{eeModalTerms}}
                    />
                </p>
                {upgradeError && (
                    <div className='upgrade-error'>
                        <div className='form-group has-error'>
                            <label className='control-label'>
                                <span
                                    dangerouslySetInnerHTML={{
                                        __html: format(upgradeError),
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}
                {restartError && (
                    <div className='col-sm-12'>
                        <div className='form-group has-error'>
                            <label className='control-label'>
                                {restartError}
                            </label>
                        </div>
                    </div>
                )}
            </>
        );
    }
    return (
        <AlertBanner
            mode='info'
            title={
                <FormattedMessage
                    id='licensingPage.infoBanner.startTrialTitle'
                    defaultMessage='Free 30 day trial!'
                />
            }
            message={
                <div className='banner-start-trial'>
                    <p className='license-trial-legal-terms'>
                        {content}
                    </p>
                    <div className='trial'>
                        {trialButton}
                    </div>
                    {upgradeTermsMessage}
                    {gettingTrialErrorMsg}
                </div>
            }
        />
    );
};

export default withOpenStartTrialFormModal(TrialBanner);
