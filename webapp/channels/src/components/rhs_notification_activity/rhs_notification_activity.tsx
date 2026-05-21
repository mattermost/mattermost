// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {clearAllPlatformNotificationRecords} from 'actions/views/rhs';
import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';

import type {PlatformNotificationRecord} from 'types/store/rhs';

import RhsNotificationCard from './rhs_notification_card';

import './rhs_notification_activity.scss';

type Props = {
    notifications: PlatformNotificationRecord[];
};

export default function RhsNotificationActivity({notifications}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();

    if (notifications.length === 0) {
        return (
            <div className='RhsNotificationActivity RhsNotificationActivity--empty'>
                <NoResultsIndicator
                    variant={NoResultsVariant.Mentions}
                    style={{padding: '48px'}}
                    title={
                        <FormattedMessage
                            id='rhs_notification_activity.empty_title'
                            defaultMessage='No notifications yet'
                        />
                    }
                    subtitle={
                        <FormattedMessage
                            id='rhs_notification_activity.empty_subtitle'
                            defaultMessage='Notifications you receive appear here and stay until you remove them or clear the list, even after you refresh or sign in again.'
                        />
                    }
                />
            </div>
        );
    }

    return (
        <div className='RhsNotificationActivity'>
            <div className='RhsNotificationActivity__toolbar'>
                <WithTooltip
                    title={intl.formatMessage({
                        id: 'rhs_notification_activity.clear_all.tooltip',
                        defaultMessage: 'Remove every notification from this list on this device',
                    })}
                >
                    <Button
                        variant='tertiary'
                        size='small'
                        onClick={() => {
                            dispatch(clearAllPlatformNotificationRecords());
                        }}
                    >
                        {intl.formatMessage({
                            id: 'rhs_notification_activity.clear_all',
                            defaultMessage: 'Clear all',
                        })}
                    </Button>
                </WithTooltip>
            </div>
            <ul className='RhsNotificationActivity__list'>
                {notifications.map((record, index) => (
                    <li
                        key={record.id}
                        className='RhsNotificationActivity__item'
                    >
                        <RhsNotificationCard
                            record={record}
                            a11yIndex={index}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
