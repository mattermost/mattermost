// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {useOpenSelfHostedZendeskSupportForm} from 'components/common/hooks/useOpenZendeskForm';


import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';
import IconMessage from 'components/purchase_modal/icon_message';

import './error_page.scss';

export default function SelfHostedExpansionErrorPage() {
    const [, contactSupportLink] = useOpenSelfHostedZendeskSupportForm('Purchase error');

    const formattedTitle = (
        <FormattedMessage
            id='admin.billing.subscription.paymentVerificationFailed'
            defaultMessage='Sorry, the payment verification failed'
        />
    );

    const formattedButtonText = (
        <FormattedMessage
            id='error_modal.try_again'
            defaultMessage='Try again'
        />
    );

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
                    //TODO: Open self hosted expansion modal
                }}
                formattedTertiaryButonText={tertiaryButtonText}
                tertiaryButtonHandler={() => window.open(contactSupportLink, '_blank', 'noreferrer')}
            />
        </div>
    );
}
