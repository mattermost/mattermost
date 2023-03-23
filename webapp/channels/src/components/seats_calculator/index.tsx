// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage, FormattedNumber} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import {Constants, ItemStatus} from 'utils/constants';

import Input from 'components/widgets/inputs/input/input';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import './seats_calculator.scss';

interface Props {
    price: number;
    seats: Seats;
    existingUsers: number;
    isCloud: boolean;
    onChange: (seats: Seats) => void;
}

export interface Seats {
    quantity: string;
    error: null | React.ReactNode;
}

const MAX_TRANSACTION_VALUE = 1_000_000 - 1;
export function calculateMaxUsers(annualPricePerSeat: number): number {
    if (annualPricePerSeat === 0) {
        return Number.MAX_SAFE_INTEGER;
    }
    return Math.floor(MAX_TRANSACTION_VALUE / annualPricePerSeat);
}

export const errorInvalidNumber = (
    <FormattedMessage
        id='self_hosted_signup.error_invalid_number'
        defaultMessage='Enter a valid number of seats'
    />
);

function validateSeats(seats: string, annualPricePerSeat: number, minSeats: number, cloud: boolean): Seats {
    if (seats === '') {
        return {
            quantity: '',
            error: errorInvalidNumber,
        };
    }

    const seatsNumber = parseInt(seats, 10);
    if (!seatsNumber && seatsNumber !== 0) {
        return {
            quantity: seats,
            error: errorInvalidNumber,
        };
    }

    const maxSeats = calculateMaxUsers(annualPricePerSeat);
    const tooFewUsersErrorMessage = (
        <FormattedMessage
            id='self_hosted_signup.error_min_seats'
            defaultMessage='Your workspace currently has {num} users'
            values={{
                num: <FormattedNumber value={minSeats}/>,
            }}
        />
    );

    let errorPrefix = (
        <FormattedMessage
            id='plan.self_serve'
            defaultMessage='Self-serve'
        />
    );
    if (cloud) {
        errorPrefix = (
            <FormattedMessage
                id='plan.cloud'
                defaultMessage='Cloud'
            />
        );
    }
    const tooManyUsersErrorMessage = (
        <>
            {errorPrefix}
            <FormattedMessage
                id='self_hosted_signup.error_max_seats'
                defaultMessage=' license purchase only supports purchases up to {num} users'
                values={{
                    num: <FormattedNumber value={maxSeats}/>,
                }}
            />
        </>
    );

    if (seatsNumber < minSeats) {
        return {
            quantity: seats,
            error: tooFewUsersErrorMessage,
        };
    }

    if (seatsNumber > maxSeats) {
        return {
            quantity: seats,
            error: tooManyUsersErrorMessage,
        };
    }

    return {
        quantity: seats,
        error: null,
    };
}
const reDigits = /^[0-9]*$/;

export default function SeatsCalculator(props: Props) {
    const intl = useIntl();
    const annualPricePerSeat = props.price * 12;
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const {value} = event.target;
        const numValue = parseInt(value, 10);
        if ((value && !numValue && numValue !== 0) || !reDigits.test(value)) {
            // We force through an onChange becuase the underlying input component
            // nulls out the customMessage. By forcefully creating a new react element error,
            // it will trigger the error still existing, and the error will keep being shown
            // in the input component
            props.onChange(validateSeats(props.seats.quantity, annualPricePerSeat, props.existingUsers, props.isCloud));
            return;
        }
        props.onChange(validateSeats(value, annualPricePerSeat, props.existingUsers, props.isCloud));
    };

    const maxSeats = calculateMaxUsers(annualPricePerSeat);
    const total = '$' + intl.formatNumber((parseFloat(props.seats.quantity) || 0) * annualPricePerSeat, {maximumFractionDigits: 2});
    const userCountTooltip = (
        <Tooltip
            id='userCount__tooltip'
            className='self-hosted-user-count-tooltip'
        >
            <div className='tooltipTitle'>
                <FormattedMessage
                    defaultMessage={'Current User Count'}
                    id={'admin.billing.subscription.userCount.tooltipTitle'}
                />
            </div>
            <div className='tooltipText'>
                <FormattedMessage
                    defaultMessage={'You must purchase at least the current number of active users.'}
                    id={'admin.billing.subscription.userCount.tooltipText'}
                />
            </div>
        </Tooltip>
    );

    return (
        <div className='SeatsCalculator'>
            <div className='SeatsCalculator__table'>
                <div className='SeatsCalculator__seats-item SeatsCalculator__seats-item--input'>
                    <div className='SeatsCalculator__seats-label'>
                        <Input
                            name='UserSeats'
                            data-testid='selfHostedPurchaseSeatsInput'
                            type='text'
                            value={props.seats.quantity}
                            onChange={onChange}
                            placeholder={intl.formatMessage({id: 'self_hosted_signup.seats', defaultMessage: 'User seats'})}
                            wrapperClassName='user_seats'
                            inputClassName='user_seats'
                            maxLength={maxSeats.toString().length + 1}
                            customMessage={props.seats.error ? {
                                type: ItemStatus.ERROR,
                                value: props.seats.error,
                            } : null}
                            autoComplete='off'
                        />
                    </div>
                    <div className='SeatsCalculator__seats-tooltip'>
                        <div className='icon'>
                            <OverlayTrigger
                                delayShow={Constants.OVERLAY_TIME_DELAY}
                                placement='right'
                                overlay={userCountTooltip}
                            >
                                <InformationOutlineIcon
                                    size={18}
                                    color={'rgba(var(--center-channel-text-rgb), 0.72)'}
                                />
                            </OverlayTrigger>
                        </div>
                    </div>
                </div>
                <div className='SeatsCalculator__seats-item'>
                    <div className='SeatsCalculator__seats-label'>
                        <FormattedMessage
                            id='self_hosted_signup.line_item_subtotal'
                            defaultMessage='{num} users × 12 mo.'
                            values={{
                                num: props.seats.quantity || '0',
                            }}
                        />
                    </div>
                    <div className='SeatsCalculator__seats-value'>
                        {total}
                    </div>
                </div>
                <div className='SeatsCalculator__total'>
                    <div className='SeatsCalculator__total-label'>
                        <FormattedMessage
                            id='self_hosted_signup.total'
                            defaultMessage='Total'
                        />
                    </div>
                    <div className='SeatsCalculator__total-value'>
                        {total}
                    </div>
                </div>
            </div>
        </div>

    );
}
