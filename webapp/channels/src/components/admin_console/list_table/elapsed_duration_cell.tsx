// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

interface Props {
    date?: number;
}

export function ElapsedDurationCell(props: Props) {
    const {formatMessage} = useIntl();

    const todaysDate = moment().startOf('day').valueOf();

    const {elapsedDays, exactPassedInDate} = useMemo(() => {
        const startOfTodayMoment = moment().startOf('day');
        const passedInDateMoment = moment(props.date);
        const exactPassedInDate = passedInDateMoment.format(
            `MMMM DD, Y [${formatMessage({id: 'adminConsole.list.table.exactTime.at', defaultMessage: 'at'})}] hh:mm:ss A`,
        );

        const startOfPassedInDateMoment = passedInDateMoment.startOf('day');

        // TODO: Use Timestamp component here
        const elapsedDays = startOfTodayMoment.diff(startOfPassedInDateMoment, 'days');

        return {
            elapsedDays,
            exactPassedInDate,
        };
    }, [props.date, todaysDate]);

    if (!props.date) {
        return null;
    }

    let elapsedDaysText = null;
    if (elapsedDays < 1) {
        elapsedDaysText = (
            <FormattedMessage
                id='admin.system_users.list.memberSince.today'
                defaultMessage='Today'
            />
        );
    } else if (elapsedDays === 1) {
        elapsedDaysText = (
            <FormattedMessage
                id='admin.system_users.list.memberSince.yesterday'
                defaultMessage='Yesterday'
            />
        );
    } else {
        elapsedDaysText = (
            <FormattedMessage
                id='admin.system_users.list.memberSince.days'
                defaultMessage='{days} days'
                values={{days: elapsedDays}}
            />
        );
    }

    return (
        <WithTooltip
            title={exactPassedInDate}
        >
            <span>{elapsedDaysText}</span>
        </WithTooltip>
    );
}
