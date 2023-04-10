// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {OutlinedInput} from '@mui/material';

import moment from 'moment-timezone';
import React, {Fragment, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {DocLinks} from 'utils/constants';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import './expansion_card.scss';
import useGetSelfHostedProducts from 'components/common/hooks/useGetSelfHostedProducts';
import {findSelfHostedProductBySku} from 'utils/hosted_customer';
import ExternalLink from 'components/external_link';

const MONTHS_IN_YEAR = 12;
const MAX_TRANSACTION_VALUE = 1_000_000 - 1;

interface Props {
    canSubmit: boolean;
    licensedSeats: number;
    initialSeats: number;
    submit: () => void;
    updateSeats: (seats: number) => void;
}

export default function SelfHostedExpansionCard(props: Props) {
    const license = useSelector(getLicense);
    const startsAt = moment(parseInt(license.StartsAt, 10)).format('MMM. D, YYYY');
    const endsAt = moment(parseInt(license.ExpiresAt, 10)).format('MMM. D, YYYY');
    const [additionalSeats, setAdditionalSeats] = useState(props.initialSeats);
    const [overMaxSeats, setOverMaxSeats] = useState(false);
    const licenseExpiry = new Date(parseInt(license.ExpiresAt, 10));
    const invalidAdditionalSeats = additionalSeats === 0 || isNaN(additionalSeats);
    const [products] = useGetSelfHostedProducts();
    const currentProduct = findSelfHostedProductBySku(products, license.SkuShortName);
    const costPerMonth = currentProduct?.price_per_seat || 0;

    const getMonthsUntilExpiry = () => {
        const now = new Date();
        return (licenseExpiry.getMonth() - now.getMonth()) + (MONTHS_IN_YEAR * (licenseExpiry.getFullYear() - now.getFullYear()));
    };

    const getCostPerUser = () => {
        if (isNaN(additionalSeats)) {
            return 0;
        }
        const monthsUntilExpiry = getMonthsUntilExpiry();
        return costPerMonth * monthsUntilExpiry;
    };

    const getTotal = () => {
        if (isNaN(additionalSeats)) {
            return 0;
        }
        const monthsUntilExpiry = getMonthsUntilExpiry();
        return additionalSeats * costPerMonth * monthsUntilExpiry;
    };

    // Finds the maximum number of additional seats that is possible, taking into account
    // the stripe transaction limit. The maximum number of seats will follow the formula:
    // (StripeTransaction Limit - (Current_Seats * Price Per Seat)) / price_per_seat
    const getMaximumAdditionalSeats = () => {
        if (currentProduct === null) {
            return 0;
        }

        const currentPaymentPrice = costPerMonth * props.licensedSeats;
        const remainingTransactionLimit = MAX_TRANSACTION_VALUE - currentPaymentPrice;
        const remainingSeats = Math.floor(remainingTransactionLimit / costPerMonth);
        return Math.max(0, remainingSeats);
    };

    const maxAdditionalSeats = getMaximumAdditionalSeats();

    const handleNewSeatsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOverMaxSeats(false);

        const requestedSeats = parseInt(e.target.value, 10);

        const overMaxAdditionalSeats = requestedSeats > maxAdditionalSeats;
        setOverMaxSeats(overMaxAdditionalSeats);

        const finalSeatCount = overMaxAdditionalSeats ? maxAdditionalSeats : requestedSeats;
        setAdditionalSeats(finalSeatCount);

        props.updateSeats(finalSeatCount);
    };

    return (
        <div className='SelfHostedExpansionRHSCard'>
            <div className='SelfHostedExpansionRHSCard__RHSCardTitle'>
                <FormattedMessage
                    id='self_hosted_expansion_rhs_license_summary_title'
                    defaultMessage='License Summary'
                />
            </div>
            <div className='SelfHostedExpansionRHSCard__Content'>
                <div className='SelfHostedExpansionRHSCard__PlanDetails'>
                    <span className='planName'>{license.SkuShortName}</span>
                    <div className='usage'>
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_license_date'
                            defaultMessage='{startsAt} - {endsAt}'
                            values={{
                                startsAt,
                                endsAt,
                            }}
                        />
                        <br/>
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_licensed_seats'
                            defaultMessage='{licensedSeats} LICENSES SEATS'
                            values={{
                                licensedSeats: props.licensedSeats,
                            }}
                        />
                    </div>
                </div>
                <hr/>
                <div className='SelfHostedExpansionRHSCard__seatInput'>
                    <FormattedMessage
                        id='self_hosted_expansion_rhs_card_add_new_seats'
                        defaultMessage='Add new seats'
                    />
                    <OutlinedInput
                        data-testid='seatsInput'
                        className='seatsInput'
                        size='small'
                        type='number'
                        value={additionalSeats}
                        onChange={handleNewSeatsInputChange}
                        error={invalidAdditionalSeats}
                        disabled={maxAdditionalSeats === 0}
                    />
                </div>
                <div className='SelfHostedExpansionRHSCard__AddSeatsWarning'>
                    {invalidAdditionalSeats && !overMaxSeats &&
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_must_add_seats_warning'
                            defaultMessage='{warningIcon} You must add a seat to continue'
                            values={{
                                warningIcon: <WarningIcon additionalClassName={'SelfHostedExpansionRHSCard__warning'}/>,
                            }}
                        />
                    }
                    {overMaxSeats && maxAdditionalSeats > 0 &&
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_maximum_seats_warning'
                            defaultMessage='{warningIcon} You may only expand by an additional {maxAdditionalSeats} seats'
                            values={{
                                maxAdditionalSeats,
                                warningIcon: <WarningIcon additionalClassName={'SelfHostedExpansionRHSCard__warning'}/>,
                            }}
                        />
                    }
                    {maxAdditionalSeats === 0 &&
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_additional_seats_limit_warning'
                            defaultMessage='{warningIcon} Transaction amount limit reached.{break}Please contact sales'
                            values={{
                                break: <br/>,
                                warningIcon: <WarningIcon additionalClassName={'SelfHostedExpansionRHSCard__warning'}/>,
                            }}
                        />
                    }
                </div>
                <div className='SelfHostedExpansionRHSCard__cost_breakdown'>
                    <div className='costPerUser'>
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_cost_per_user_title'
                            defaultMessage='Cost per user'
                        />
                        <br/>
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_cost_per_user_breakdown'
                            /* eslint-disable no-template-curly-in-string*/
                            defaultMessage='${costPerUser} x {monthsUntilExpiry} months'
                            values={{
                                costPerUser: costPerMonth.toFixed(2),
                                monthsUntilExpiry: getMonthsUntilExpiry(),
                            }}
                        />
                    </div>
                    <div className='costAmount'>
                        <span>{'$' + getCostPerUser().toFixed(2)}</span>
                    </div>
                    <div className='totalCostWarning'>
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_total_title'
                            defaultMessage='Total'
                        />
                        <br/>
                        <FormattedMessage
                            id='self_hosted_expansion_rhs_card_total_prorated_warning'
                            defaultMessage='The total will be prorated'
                        />
                    </div>
                    <span className='totalCostAmount'>
                        <span>{'$' + getTotal().toFixed(2)}</span>
                    </span>
                </div>
                <button
                    className='btn btn-primary SelfHostedExpansionRHSCard__CompletePurchaseButton'
                    disabled={!props.canSubmit || maxAdditionalSeats === 0}
                    onClick={props.submit}
                >
                    <FormattedMessage
                        id='self_hosted_expansion_rhs_complete_button'
                        defaultMessage='Complete purchase'
                    />
                </button>
                <div className='SelfHostedExpansionRHSCard__ChargedTodayDisclaimer'>
                    <FormattedMessage
                        id='self_hosted_expansion_rhs_credit_card_charge_today_warning'
                        defaultMessage='Your credit card will be charged today.<see_how_billing_works>See how billing works.</see_how_billing_works>'
                        values={{
                            see_how_billing_works: (text: string) => (
                                <>
                                    <br/>
                                    <ExternalLink
                                        href={DocLinks.SELF_HOSTED_BILLING}
                                    >
                                        {text}
                                    </ExternalLink>
                                </>
                            ),
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
