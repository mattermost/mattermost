// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {SelfHostedSignupProgress} from '@mattermost/types/hosted_customer';
import type {ValueOf} from '@mattermost/types/utilities';

import {getSelfHostedSignupProgress} from 'mattermost-redux/selectors/entities/hosted_customer';

import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import IconMessage from 'components/purchase_modal/icon_message';

import './submitting_page.scss';

function useConvertProgressToWaitingExplanation(progress: ValueOf<typeof SelfHostedSignupProgress>, planName: string): React.ReactNode {
    const intl = useIntl();
    switch (progress) {
    case SelfHostedSignupProgress.START:
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
    case SelfHostedSignupProgress.CREATED_INTENT:
        return intl.formatMessage({
            id: 'self_hosted_signup.progress_step.submitting_payment',
            defaultMessage: 'Submitting payment information',
        });
    case SelfHostedSignupProgress.CONFIRMED_INTENT:
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
        return intl.formatMessage({
            id: 'self_hosted_signup.progress_step.verifying_payment',
            defaultMessage: 'Verifying payment details',
        });
    case SelfHostedSignupProgress.PAID:
    case SelfHostedSignupProgress.CREATED_LICENSE:
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
        return 15;
    case SelfHostedSignupProgress.CREATED_CUSTOMER:
        return 30;
    case SelfHostedSignupProgress.CREATED_INTENT:
        return 45;
    case SelfHostedSignupProgress.CONFIRMED_INTENT:
        return 60;
    case SelfHostedSignupProgress.CREATED_SUBSCRIPTION:
        return 75;
    case SelfHostedSignupProgress.PAID:
        return 85;
    case SelfHostedSignupProgress.CREATED_LICENSE:
        return 100;
    default:
        return 0;
    }
}

interface Props {
    currentPlan: string;
}

const maxProgressBar = 100;
const maxFakeProgressIncrement = 5;
const fakeProgressInterval = 600;

export default function Submitting(props: Props) {
    const [barProgress, setBarProgress] = useState(0);
    const signupProgress = useSelector(getSelfHostedSignupProgress);
    const waitingExplanation = useConvertProgressToWaitingExplanation(signupProgress, props.currentPlan);
    const footer = (
        <div className='ProcessPayment-progress'>
            <div
                className='ProcessPayment-progress-fill'
                style={{width: `${barProgress}%`}}
            />
        </div>
    );

    useEffect(() => {
        const maxProgressForCurrentSignupProgress = convertProgressToBar(signupProgress);
        const interval = setInterval(() => {
            if (barProgress < maxProgressBar) {
                setBarProgress(Math.min(maxProgressForCurrentSignupProgress, barProgress + maxFakeProgressIncrement));
            }
        }, fakeProgressInterval);

        return () => clearInterval(interval);
    }, [barProgress]);

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
