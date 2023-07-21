// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Product} from '@mattermost/types/cloud';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import PlanLabel from 'components/common/plan_label';
import {Card, ButtonCustomiserClasses} from 'components/purchase_modal/purchase_modal';
import StarMarkSvg from 'components/widgets/icons/star_mark_icon';

import SeatsCalculator, {Seats} from '../../seats_calculator';
import Consequences from '../../seats_calculator/consequences';
import {
    SelfHostedProducts,
} from 'utils/constants';

// Card has a bunch of props needed for monthly/yearly payments that
// do not apply to self-hosted.
const dummyCardProps = {
    isCloud: false,
    usersCount: 0,
    yearlyPrice: 0,
    monthlyPrice: 0,
    isInitialPlanMonthly: false,
    updateIsMonthly: () => {},
    updateInputUserCount: () => {},
    setUserCountError: () => {},
    isCurrentPlanMonthlyProfessional: false,
};

interface Props {
    desiredPlanName: string;
    desiredProduct: Product;
    seats: Seats;
    currentUsers: number;
    updateSeats: (seats: Seats) => void;
    canSubmit: boolean;
    submit: () => void;
}

export default function SelfHostedCard(props: Props) {
    const intl = useIntl();
    const openPricingModal = useOpenPricingModal();

    const showPlanLabel = props.desiredProduct.sku === SelfHostedProducts.PROFESSIONAL;

    const comparePlan = (
        <button
            className='ml-1'
            onClick={() => {
                trackEvent('self_hosted_pricing', 'click_compare_plans');
                openPricingModal({trackingLocation: 'purchase_modal_compare_plans_click'});
            }}
        >
            <FormattedMessage
                id='cloud_subscribe.contact_support'
                defaultMessage='Compare plans'
            />
        </button>
    );
    const comparePlanWrapper = (
        <div
            className={showPlanLabel ? 'plan_comparison show_label' : 'plan_comparison'}
        >
            {comparePlan}
        </div>
    );

    return (
        <>
            {comparePlanWrapper}
            <Card
                {...dummyCardProps}
                topColor='#4A69AC'
                plan={props.desiredPlanName}
                price={`${props.desiredProduct?.price_per_seat?.toString()}`}
                rate={intl.formatMessage({id: 'pricing_modal.rate.seatPerMonth', defaultMessage: 'USD per seat/month {br}<b>(billed annually)</b>'}, {
                    br: <br/>,
                    b: (chunks: React.ReactNode | React.ReactNodeArray) => (
                        <span style={{fontSize: '14px'}}>
                            <b>{chunks}</b>
                        </span>
                    ),
                })}
                planBriefing={<></>}
                preButtonContent={(
                    <SeatsCalculator
                        price={props.desiredProduct?.price_per_seat}
                        seats={props.seats}
                        existingUsers={props.currentUsers}
                        isCloud={false}
                        onChange={props.updateSeats}
                    />
                )}
                afterButtonContent={
                    <Consequences
                        isCloud={false}
                        licenseAgreementBtnText={intl.formatMessage({id: 'self_hosted_signup.cta', defaultMessage: 'Upgrade'})}
                    />
                }
                buttonDetails={{
                    action: props.submit,
                    disabled: !props.canSubmit,
                    text: intl.formatMessage({id: 'self_hosted_signup.cta', defaultMessage: 'Upgrade'}),
                    customClass: props.canSubmit ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.grayed,
                }}
                planLabel={
                    showPlanLabel ? (
                        <PlanLabel
                            text={intl.formatMessage({
                                id: 'pricing_modal.planLabel.mostPopular',
                                defaultMessage: 'MOST POPULAR',
                            })}
                            bgColor='var(--title-color-indigo-500)'
                            color='var(--button-color)'
                            firstSvg={<StarMarkSvg/>}
                            secondSvg={<StarMarkSvg/>}
                        />
                    ) : undefined
                }
            />
        </>
    );
}
