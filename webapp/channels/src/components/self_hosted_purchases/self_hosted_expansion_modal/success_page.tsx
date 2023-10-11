// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';

import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';
import IconMessage from 'components/purchase_modal/icon_message';

import {ConsolePages, TELEMETRY_CATEGORIES} from 'utils/constants';

import './success_page.scss';

interface Props {
    onClose: () => void;
}

export default function SelfHostedExpansionSuccessPage(props: Props) {
    const history = useHistory();
    const titleText = (
        <FormattedMessage
            id={'self_hosted_expansion.expand_success'}
            defaultMessage={"You've successfully updated your license seat count"}
        />
    );

    const formattedSubtitleText = (
        <FormattedMessage
            id={'self_hosted_expansion.license_applied'}
            defaultMessage={'The license has been automatically applied to your Mattermost instance. Your updated invoice will be visible in the <billing>Billing section</billing> of the system console.'}
            values={{
                billing: (billingText: React.ReactNode) => (
                    <a
                        href='#'
                        onClick={() => {
                            trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_EXPANSION, 'success_screen_closed');
                            history.push(ConsolePages.BILLING_HISTORY);
                            props.onClose();
                        }}
                    >
                        {billingText}
                    </a>
                ),
            }}
        />
    );

    const formattedButtonText = (
        <FormattedMessage
            id={'self_hosted_expansion.close'}
            defaultMessage={'Close'}
        />
    );

    const icon = (
        <PaymentSuccessStandardSvg
            width={444}
            height={313}
        />
    );

    return (
        <div className='self_hosted_expansion_success'>
            <IconMessage
                className={'selfHostedExpansionModal__success'}
                formattedTitle={titleText}
                formattedSubtitle={formattedSubtitleText}
                testId='selfHostedExpansionSuccess'
                icon={icon}
                formattedButtonText={formattedButtonText}
                buttonHandler={props.onClose}
            />
        </div>
    );
}

