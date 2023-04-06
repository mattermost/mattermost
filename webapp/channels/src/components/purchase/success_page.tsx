// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import IconMessage from 'components/purchase_modal/icon_message';
import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';
import {ConsolePages} from 'utils/constants';

interface Props {
    planName: string;
    onClose: () => void;
    isRenewal?: boolean;
}
import './success_page.scss';

export default function SuccessPage(props: Props) {
    let title = (
        <FormattedMessage
            id={'admin.billing.subscription.upgradedSuccess'}
            defaultMessage={'You\'re now subscribed to {productName}'}
            values={{productName: props.planName}}
        />
    );
    let formattedSubtitle = (
        <FormattedMessage
            id={'self_hosted_signup.license_applied'}
            defaultMessage={'Your {planName} license has now been applied. {planName} features are now available and ready to use.'}
            values={{planName: props.planName}}
        />
    );
    if (props.isRenewal) {
        title = (
            <FormattedMessage
                id='self_hosted_renewal.success.title'
                defaultMessage='You’ve successfully renewed your license!'
            />
        );
        formattedSubtitle = (
            <FormattedMessage
                id='self_hosted_renewal.success.subtitle'
                defaultMessage='The license has been automatically applied to your Mattermost instance. Your updated invoice will be visible in the <a>Billing section</a> of the system console.'
                values={{
                    a: (text: React.ReactNode | React.ReactNodeArray) => {
                        <a
                            href={ConsolePages.BILLING_HISTORY}
                        >
                            {text}
                        </a>;
                    },
                }}
            />
        );
    }
    const formattedBtnText = (
        <FormattedMessage
            id={'self_hosted_signup.close'}
            defaultMessage={'Close'}
        />
    );
    return (
        <div className='success'>
            <IconMessage
                className={'SelfHostedPurchaseModal__success'}
                formattedTitle={title}
                formattedSubtitle={formattedSubtitle}
                testId={props.isRenewal ? 'selfHostedRenewalSuccess' : 'selfHostedPurchaseSuccess'}
                icon={
                    <PaymentSuccessStandardSvg
                        width={444}
                        height={313}
                    />
                }
                formattedButtonText={formattedBtnText}
                buttonHandler={props.onClose}
            />
        </div>
    );
}

