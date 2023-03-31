// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';
import AccessDeniedHappySvg from 'components/common/svg_images_components/access_denied_happy_svg';
import IconMessage from 'components/purchase_modal/icon_message';
import {useOpenSelfHostedZendeskSupportForm} from 'components/common/hooks/useOpenZendeskForm';
import ExternalLink from 'components/external_link';

interface Props {
    nextAction: () => void;
    canRetry: boolean;
    errorType: 'failed_export' | 'generic';
}

export default function ErrorPage(props: Props) {
    const [, contactSupportLink] = useOpenSelfHostedZendeskSupportForm('Purchase error');
    let formattedTitle = (
        <FormattedMessage
            id='admin.billing.subscription.paymentVerificationFailed'
            defaultMessage='Sorry, the payment verification failed'
        />
    );
    let formattedButtonText = (
        <FormattedMessage
            id='self_hosted_signup.retry'
            defaultMessage='Try again'
        />
    );

    if (!props.canRetry) {
        formattedButtonText = (
            <FormattedMessage
                id='self_hosted_signup.close'
                defaultMessage='Close'
            />
        );
    }

    let formattedSubtitle = (
        <FormattedMessage
            id='admin.billing.subscription.paymentFailed'
            defaultMessage='Payment failed. Please try again or contact support.'
        />
    );

    let icon = (
        <PaymentFailedSvg
            width={444}
            height={313}
        />
    );

    if (props.errorType === 'failed_export') {
        formattedTitle = (
            <FormattedMessage
                id='self_hosted_signup.failed_export.title'
                defaultMessage='Your transaction is being reviewed'
            />
        );

        formattedSubtitle = (
            <FormattedMessage
                id='self_hosted_signup.failed_export.subtitle'
                defaultMessage='We will check things on our side and get back to you within 3 days once your license is approved. In the meantime, please feel free to continue using the free version of our product.'
            />
        );

        icon = (
            <AccessDeniedHappySvg
                width={444}
                height={313}
            />
        );
    }

    return (
        <div className='failed'>
            <IconMessage
                formattedTitle={formattedTitle}
                formattedSubtitle={formattedSubtitle}
                icon={icon}
                error={true}
                formattedButtonText={formattedButtonText}
                buttonHandler={props.nextAction}
                formattedLinkText={
                    <ExternalLink
                        href={contactSupportLink}
                        location='self_hosted_purchase_modal_error'
                    >
                        <FormattedMessage
                            id='admin.billing.subscription.privateCloudCard.contactSupport'
                            defaultMessage='Contact Support'
                        />
                    </ExternalLink>
                }
            />
        </div>
    );
}
