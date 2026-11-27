// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import AlertBanner from 'components/alert_banner';
import withOpenStartTrialFormModal from 'components/common/hocs/cloud/with_open_start_trial_form_modal';
import ExternalLink from 'components/external_link';

import {AboutLinks, LicenseLinks} from 'utils/constants';

interface TrialBannerProps {
    isDisabled: boolean;
    gettingTrialError: string | null;
    gettingTrialResponseCode: number | null;
    gettingTrial: boolean;
    openTrialForm?: () => void;
}

export const EmbargoedEntityTrialError = () => {
    return (
        <FormattedMessage
            id='admin.license.trial-request.embargoed'
            defaultMessage='We were unable to process the request due to limitations for embargoed countries. <link>Learn more in our documentation</link>, or reach out to legal@mattermost.com for questions around export limitations.'
            values={{
                link: (text) => (
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
    openTrialForm,
}: TrialBannerProps) => {
    const {formatMessage} = useIntl();
    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);

    useEffect(() => {
        if (gettingTrial && !gettingTrialError && gettingTrialResponseCode !== 200) {
            setLoadStatus(TrialLoadStatus.Started);
        } else if (gettingTrialError) {
            setLoadStatus(TrialLoadStatus.Failed);
        } else if (gettingTrialResponseCode === 451) {
            setLoadStatus(TrialLoadStatus.Embargoed);
        }
    }, [gettingTrial, gettingTrialError, gettingTrialResponseCode]);

    const btnText = (trialStatus: TrialLoadStatus) => {
        switch (trialStatus) {
        case TrialLoadStatus.Started:
            return formatMessage({id: 'start_trial.modal.gettingTrial', defaultMessage: 'Getting Trial...'});
        case TrialLoadStatus.Success:
            return formatMessage({id: 'start_trial.modal.loaded', defaultMessage: 'Loaded!'});
        case TrialLoadStatus.Failed:
            return formatMessage({id: 'start_trial.modal.failed', defaultMessage: 'Failed'});
        case TrialLoadStatus.Embargoed:
            return formatMessage(
                {
                    id: 'admin.license.trial-request.embargoed',
                    defaultMessage: 'We were unable to process the request due to limitations for embargoed countries. <link>Learn more in our documentation</link>, or reach out to legal@mattermost.com for questions around export limitations.',
                },
                {
                    link: (text) => (
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
        openTrialForm?.();
    };

    let gettingTrialErrorMsg;
    if (gettingTrialError) {
        gettingTrialErrorMsg = gettingTrialResponseCode === 451 ? (
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

    return (
        <AlertBanner
            mode='info'
            title={
                <FormattedMessage
                    id='licensingPage.infoBanner.startTrialTitle'
                    defaultMessage='Start a free 30-day trial of Mattermost Enterprise Advanced'
                />
            }
            message={
                <div className='banner-start-trial'>
                    <p className='license-trial-legal-terms'>
                        <FormattedMessage
                            id='admin.license.trial-request.title'
                            defaultMessage='Experience all that Mattermost Enterprise Advanced has to offer with a free trial for the next 30 days. No obligation to buy and no credit card required. '
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
                    </p>
                    <div className='trial'>
                        <Button
                            type='button'
                            emphasis='primary'
                            onClick={handleRequestLicense}
                            disabled={isDisabled || gettingTrialError !== null || gettingTrialResponseCode === 451}
                        >
                            {btnText(status)}
                        </Button>
                    </div>
                    {gettingTrialErrorMsg}
                </div>
            }
        />
    );
};

export default withOpenStartTrialFormModal(TrialBanner);
