// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';
import IconMessage from 'components/purchase_modal/icon_message';

import './success_page.scss';

interface Props {
    planName: string;
    onClose: () => void;

}

export default function SuccessPage(props: Props) {
    const title = (
        <FormattedMessage
            id={'admin.billing.subscription.subscribedSuccess'}
            defaultMessage={'You\'re now subscribed to {productName}'}
            values={{productName: props.planName}}
        />
    );
    const formattedSubtitle = (
        <FormattedMessage
            id={'self_hosted_signup.license_applied'}
            defaultMessage={'Your {planName} license has now been applied. {planName} features are now available and ready to use.'}
            values={{planName: props.planName}}
        />
    );
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
                testId='selfHostedPurchaseSuccess'
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

