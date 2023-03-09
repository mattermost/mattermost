// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Invoice, InvoiceLineItemType} from '@mattermost/types/cloud';

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
                id='admin.billing.history.onPremUsers'
                defaultMessage='{num} users'
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
                    id='admin.billing.history.fractionalAndRatedUsers'
                    defaultMessage='{fractionalUsers} metered users, {fullUsers} users at full rate, {partialUsers} users with partial charges'
                    values={{
                        fractionalUsers: numberToFixedDynamic(meteredUsers, 2),
                        fullUsers: fullUsers.toFixed(0),
                        partialUsers: partialUsers.toFixed(0),
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='admin.billing.history.fractionalUsers'
                defaultMessage='{fractionalUsers} users'
                values={{
                    fractionalUsers: numberToFixedDynamic(meteredUsers, 2),
                }}
            />
        );
    }

    return (
        <FormattedMessage
            id='admin.billing.history.usersAndRates'
            defaultMessage='{fullUsers} users at full rate, {partialUsers} users with partial charges'
            values={{
                fullUsers: fullUsers.toFixed(0),
                partialUsers: partialUsers.toFixed(0),
            }}
        />
    );
}
