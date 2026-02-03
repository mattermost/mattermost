// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl, FormattedMessage, FormattedNumber, defineMessages} from 'react-intl';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import Input from 'components/widgets/inputs/input/input';
import WithTooltip from 'components/with_tooltip';

import {ItemStatus} from 'utils/constants';

import './seats_calculator.scss';

const messages = defineMessages({
    tooltipText: {
        id: 'admin.billing.subscription.userCount.tooltipTitle',
        defaultMessage: 'Current User Count',
    },
    tooltipTitle: {
        id: 'admin.billing.subscription.userCount.tooltipText',
        defaultMessage: 'You must purchase at least the current number of active users.',
    },
});

interface Props {
    price: number;
    seats: Seats;
    existingUsers: number;
    isCloud: boolean;
    onChange: (seats: Seats) => void;
    excludeTotal?: boolean;
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
export const errorMinSeats = (
    <FormattedMessage
        id='cloud_upgrade.error_min_seats'
        defaultMessage='Minimum of 10 seats required'
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

    if (seatsNumber < 10) {
        return {
            quantity: seats,
            error: errorMinSeats,
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
                defaultMessage=' license purchase only supports purchases up to {num} seats'
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

    useEffect(() => {
        props.onChange(validateSeats(props.seats.quantity, annualPricePerSeat, props.existingUsers, props.isCloud));
    }, []);

    const maxSeats = calculateMaxUsers(annualPricePerSeat);
    const total = '$' + intl.formatNumber((parseFloat(props.seats.quantity) || 0) * annualPricePerSeat, {maximumFractionDigits: 2});

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
                            placeholder={intl.formatMessage({id: 'self_hosted_signup.seats', defaultMessage: 'Seats'})}
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
                            <WithTooltip
                                title={messages.tooltipTitle}
                                hint={messages.tooltipText}
                                isVertical={false}
                            >
                                <InformationOutlineIcon
                                    size={18}
                                    color={'rgba(var(--center-channel-text-rgb), 0.75)'}
                                />
                            </WithTooltip>
                        </div>
                    </div>
                </div>
                {!props.excludeTotal && (
                    <>
                        <div className='SeatsCalculator__seats-item'>
                            <div className='SeatsCalculator__seats-label'>
                                <FormattedMessage
                                    id='self_hosted_signup.line_item_subtotal'
                                    defaultMessage='{num} seats × 12 mo.'
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
                    </>
                )}
            </div>
        </div>
    );
}
