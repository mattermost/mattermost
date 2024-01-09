// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import {TELEMETRY_CATEGORIES, CloudLinks} from 'utils/constants';

import type {ButtonDetails} from './purchase_modal';

type DelinquencyCardProps = {
    topColor: string;
    price: string;
    buttonDetails: ButtonDetails;
    onViewBreakdownClick: () => void;
    isCloudDelinquencyGreaterThan90Days: boolean;
    users: number;
    cost: number;
};

export default function DelinquencyCard(props: DelinquencyCardProps) {
    const handleSeeHowBillingWorksClick = (
        e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    ) => {
        e.preventDefault();
        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_ADMIN,
            'click_see_how_billing_works',
        );
        window.open(CloudLinks.DELINQUENCY_DOCS, '_blank');
    };

    const seeHowBillingWorks = (
        <a onClick={handleSeeHowBillingWorksClick}>
            <FormattedMessage
                defaultMessage={'See how billing works.'}
                id={
                    'admin.billing.subscription.howItWorks'
                }
            />
        </a>
    );

    return (
        <div className='PlanCard'>
            <div
                className='top'
                style={{backgroundColor: props.topColor}}
            />
            <div className='bottom delinquency'>
                <div className='delinquency_summary_section'>
                    <div className={'summary-section'}>
                        <div className='summary-title'>
                            <FormattedMessage
                                id={'cloud_delinquency.cc_modal.card.totalOwed'}
                                defaultMessage={'Total Owed'}
                            />
                            {':'}
                        </div>
                        <div className='summary-total'>{props.price}</div>
                        <div
                            onClick={props.onViewBreakdownClick}
                            className='view-breakdown'
                        >
                            <FormattedMessage
                                defaultMessage={'View Breakdown'}
                                id={
                                    'cloud_delinquency.cc_modal.card.viewBreakdown'
                                }
                            />
                        </div>
                    </div>
                </div>
                <div>
                    <button
                        className={
                            'plan_action_btn ' + props.buttonDetails.customClass
                        }
                        disabled={props.buttonDetails.disabled}
                        onClick={props.buttonDetails.action}
                    >
                        {props.buttonDetails.text}
                    </button>
                </div>
                <div className='plan_billing_cycle delinquency'>
                    {Boolean(!props.isCloudDelinquencyGreaterThan90Days) && (
                        <FormattedMessage
                            defaultMessage={
                                'When you reactivate your subscription, you\'ll be billed the total outstanding amount immediately. Your bill is calculated at the end of the billing cycle based on the number of active users. {seeHowBillingWorks}'
                            }
                            id={'cloud_delinquency.cc_modal.disclaimer'}
                            values={{
                                seeHowBillingWorks,
                            }}
                        />
                    )}
                    {Boolean(props.isCloudDelinquencyGreaterThan90Days) && (
                        <FormattedMessage
                            defaultMessage={
                                'When you reactivate your subscription, you\'ll be billed the total outstanding amount immediately. You\'ll also be billed {cost} immediately for a 1 year subscription based on your current active user count of {users} users. {seeHowBillingWorks}'
                            }
                            id={
                                'cloud_delinquency.cc_modal.disclaimer_with_upgrade_info'
                            }
                            values={{
                                cost: `$${props.cost}`,
                                users: props.users,
                                seeHowBillingWorks,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

