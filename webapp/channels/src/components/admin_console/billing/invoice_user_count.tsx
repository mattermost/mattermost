// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {InvoiceLineItemType} from '@mattermost/types/cloud';
import type {Invoice} from '@mattermost/types/cloud';

import {numberToFixedDynamic} from 'utils/utils';

export default function InvoiceUserCount({invoice}: {invoice: Invoice}): JSX.Element {
    const fullUsers = invoice.line_items.filter((item) => item.type === InvoiceLineItemType.Full).reduce((val, item) => val + item.quantity, 0);
    const partialUsers = invoice.line_items.filter((item) => item.type === InvoiceLineItemType.Partial).reduce((val, item) => val + item.quantity, 0);
    const meteredUsers = invoice.line_items.filter((item) => item.type === InvoiceLineItemType.Metered).reduce((val, item) => val + item.quantity, 0);
    const onPremUsers = invoice.line_items.filter((item) => item.type === InvoiceLineItemType.OnPremise).reduce((val, item) => val + item.quantity, 0);

    // e.g. purchased through self-hosted flow.
    if (onPremUsers) {
        return (
            <FormattedMessage
                id='admin.billing.history.onPremSeats'
                defaultMessage='{num} seats'
                values={{

                    // should always be a whole number, but truncate just in case
                    num: Math.floor(onPremUsers),
                }}
            />
        );
    }
    if (meteredUsers) {
        if (fullUsers || partialUsers) {
            return (
                <FormattedMessage
                    id='admin.billing.history.fractionalAndRatedSeats'
                    defaultMessage='{fractionalSeats} metered seats, {fullSeats} seats at full rate, {partialSeats} seats with partial charges'
                    values={{
                        fractionalSeats: numberToFixedDynamic(meteredUsers, 2),
                        fullSeats: fullUsers.toFixed(0),
                        partialSeats: partialUsers.toFixed(0),
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='admin.billing.history.fractionalSeats'
                defaultMessage='{fractionalSeats} seats'
                values={{
                    fractionalSeats: numberToFixedDynamic(meteredUsers, 2),
                }}
            />
        );
    }

    return (
        <FormattedMessage
            id='admin.billing.history.seatsAndRates'
            defaultMessage='{fullSeats} seats at full rate, {partialSeats} seats with partial charges'
            values={{
                fullSeats: fullUsers.toFixed(0),
                partialSeats: partialUsers.toFixed(0),
            }}
        />
    );
}
