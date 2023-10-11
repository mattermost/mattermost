// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import {useOpenSelfHostedZendeskSupportForm} from 'components/common/hooks/useOpenZendeskForm';
import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';
import IconMessage from 'components/purchase_modal/icon_message';

import {TELEMETRY_CATEGORIES} from 'utils/constants';

import './error_page.scss';

interface Props {
    canRetry: boolean;
    tryAgain: () => void;
}

export default function SelfHostedExpansionErrorPage(props: Props) {
    const [, contactSupportLink] = useOpenSelfHostedZendeskSupportForm('Purchase error');

    const formattedTitle = (
        <FormattedMessage
            id='admin.billing.subscription.paymentVerificationFailed'
            defaultMessage='Sorry, the payment verification failed'
        />
    );

    let formattedButtonText = (
        <FormattedMessage
            id='self_hosted_expansion.try_again'
            defaultMessage='Try again'
        />
    );

    if (!props.canRetry) {
        formattedButtonText = (
            <FormattedMessage
                id='self_hosted_expansion.close'
                defaultMessage='Close'
            />
        );
    }

    const formattedSubtitle = (
        <FormattedMessage
            id='self_hosted_expansion.paymentFailed'
            defaultMessage='Payment failed. Please try again or contact support.'
        />
    );

    const tertiaryButtonText = (
        <FormattedMessage
            id='self_hosted_expansion.contact_support'
            defaultMessage={'Contact Support'}
        />
    );

    const icon = (
        <PaymentFailedSvg
            width={444}
            height={313}
        />
    );

    return (
        <div className='self_hosted_expansion_failed'>
            <IconMessage
                formattedTitle={formattedTitle}
                formattedSubtitle={formattedSubtitle}
                icon={icon}
                error={true}
                formattedButtonText={formattedButtonText}
                buttonHandler={() => {
                    trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_EXPANSION, 'failure_try_again_clicked');
                    props.tryAgain();
                }}
                formattedTertiaryButonText={tertiaryButtonText}
                tertiaryButtonHandler={() => {
                    trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_EXPANSION, 'failure_contact_support_clicked');
                    window.open(contactSupportLink, '_blank', 'noreferrer');
                }}
            />
        </div>
    );
}
