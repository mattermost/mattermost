// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import ExternalLink from 'components/external_link';

import {
    TELEMETRY_CATEGORIES,
    HostedCustomerLinks,
    CloudLinks,
    LicenseLinks,
} from 'utils/constants';

type Props = {
    isCloud: boolean;
    licenseAgreementBtnText: string;
}

export default function Consequences(props: Props) {
    let telemetryHandler = () => {};
    if (props.isCloud) {
        telemetryHandler = () =>
            trackEvent(
                TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                'click_see_how_billing_works',
            );
    } else {
        telemetryHandler = () =>
            trackEvent(
                TELEMETRY_CATEGORIES.SELF_HOSTED_PURCHASING,
                'click_see_how_billing_works',
            );
    }
    let text = (
        <FormattedMessage
            defaultMessage={
                'You will be billed today. Your license will be applied automatically. <a>See how billing works.</a>'
            }
            id={'self_hosted_signup.signup_consequences'}
            values={{
                a: (chunks: React.ReactNode) => (
                    <ExternalLink
                        onClick={telemetryHandler}
                        href={
                            props.isCloud ? CloudLinks.BILLING_DOCS : HostedCustomerLinks.BILLING_DOCS
                        }
                        location='seats_calculator_consequences'
                    >
                        {chunks}
                    </ExternalLink>
                ),
            }}
        />
    );

    const licenseAgreement = (
        <FormattedMessage
            defaultMessage={
                'By clicking {buttonContent}, you agree to the <linkAgreement>{legalText}</linkAgreement>'
            }
            id={'admin.billing.subscription.byClickingYouAgree'}
            values={{
                buttonContent: props.licenseAgreementBtnText.toLowerCase(),
                legalText: LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT_TEXT,
                linkAgreement: (legalText: React.ReactNode) => (
                    <ExternalLink
                        href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                        location='seats_calculator_consequences'
                    >
                        {legalText}
                    </ExternalLink>
                ),
            }}
        />
    );

    if (props.isCloud) {
        text = (
            <FormattedMessage
                defaultMessage={'Your credit card will be charged today. <a>See how billing works.</a>'}
                id={'cloud_signup.signup_consequences'}
                values={{
                    a: (chunks: React.ReactNode) => (
                        <ExternalLink
                            onClick={telemetryHandler}
                            href={props.isCloud ? CloudLinks.BILLING_DOCS : HostedCustomerLinks.BILLING_DOCS}
                        >
                            {chunks}
                        </ExternalLink>
                    ),
                }}
            />);
    }
    return (
        <div className='signup-consequences'>
            {text}
            {licenseAgreement}
        </div>
    );
}
