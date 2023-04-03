// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage, useIntl} from 'react-intl';

import {useSelector} from 'react-redux';

import {getSelfHostedSignupProgress, getSelfHostedRenewalProgress} from 'mattermost-redux/selectors/entities/hosted_customer';
import {SelfHostedSignupProgress, SelfHostedRenewalProgress} from '@mattermost/types/hosted_customer';
import {ValueOf} from '@mattermost/types/utilities';

import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import IconMessage from 'components/purchase_modal/icon_message';

function useConvertProgressToWaitingExplanation(progress: ValueOf<typeof SelfHostedSignupProgress> | ValueOf<typeof SelfHostedRenewalProgress>, planName: string): React.ReactNode {
    const intl = useIntl();
    switch (progress) {
    case SelfHostedSignupProgress.START:
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
    case SelfHostedSignupProgress.CREATED_INTENT:
    case SelfHostedRenewalProgress.START:
    case SelfHostedRenewalProgress.CREATED_CUSTOMER:
    case SelfHostedRenewalProgress.CREATED_INTENT:
        return intl.formatMessage({
            id: 'self_hosted_signup.progress_step.submitting_payment',
            defaultMessage: 'Submitting payment information',
        });
    case SelfHostedSignupProgress.CONFIRMED_INTENT:
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
    case SelfHostedRenewalProgress.CONFIRMED_INTENT:
    case SelfHostedRenewalProgress.CREATED_SUBSCRIPTION:
        return intl.formatMessage({
            id: 'self_hosted_signup.progress_step.verifying_payment',
            defaultMessage: 'Verifying payment details',
        });
    case SelfHostedSignupProgress.PAID:
    case SelfHostedSignupProgress.PAID:
    case SelfHostedRenewalProgress.CREATED_LICENSE:
    case SelfHostedRenewalProgress.CREATED_LICENSE:
        return intl.formatMessage({
            id: 'self_hosted_signup.progress_step.applying_license',
            defaultMessage: 'Applying your {planName} license to your Mattermost instance',
        }, {planName});
    default:
        return intl.formatMessage({
            id: 'self_hosted_signup.progress_step.submitting_payment',
            defaultMessage: 'Submitting payment information',
        });
    }
}

export function convertProgressToBar(progress: ValueOf<typeof SelfHostedSignupProgress>): number {
    switch (progress) {
    case SelfHostedSignupProgress.START:
        return 0;
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
        return 10;
    case SelfHostedSignupProgress.CREATED_INTENT:
        return 20;
    case SelfHostedSignupProgress.CONFIRMED_INTENT:
        return 30;
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
        return 50;
    case SelfHostedSignupProgress.PAID:
        return 90;
    case SelfHostedSignupProgress.CREATED_LICENSE:
        return 100;
    default:
        return 0;
    }
}

export function convertRenewalProgressToBar(progress: ValueOf<typeof SelfHostedRenewalProgress>): number {
    switch (progress) {
    case SelfHostedSignupProgress.START:
        return 0;
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
        return 10;
    case SelfHostedSignupProgress.CREATED_INTENT:
        return 20;
    case SelfHostedSignupProgress.CONFIRMED_INTENT:
        return 30;
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
        return 50;
    case SelfHostedSignupProgress.PAID:
        return 90;
    case SelfHostedSignupProgress.CREATED_LICENSE:
        return 100;
    default:
        return 0;
    }
}


interface Props {
    desiredPlanName: string;
    progressBar: number;
    isRenewal?: boolean;
}

export default function Submitting(props: Props) {
    const progress = useSelector(props.isRenewal ? getSelfHostedRenewalProgress : getSelfHostedSignupProgress);
    const waitingExplanation = useConvertProgressToWaitingExplanation(progress, props.desiredPlanName);
    const footer = (
        <div className='ProcessPayment-progress'>
            <div
                className='ProcessPayment-progress-fill'
                style={{width: `${props.progressBar}%`}}
            />
        </div>
    );

    return (

        <div className='submitting'>
            <IconMessage
                formattedTitle={(
                    <FormattedMessage
                        id='admin.billing.subscription.verifyPaymentInformation'
                        defaultMessage='Verifying your payment information'
                    />
                )}
                formattedSubtitle={waitingExplanation}
                icon={
                    <CreditCardSvg
                        width={444}
                        height={313}
                    />
                }
                footer={footer}
                className={'processing'}
            />
        </div>
    );
}
