// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPostsByIdsBatched} from 'mattermost-redux/actions/posts';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getDateForDateLine, isDateLine} from 'mattermost-redux/utils/post_list';

import {fillPlatformNotificationActivity} from 'actions/views/platform_notification_activity';
import {reconcilePlatformNotificationActivity} from 'actions/views/rhs';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import DateSeparator from 'components/post_view/date_separator';

import {addDateSeparatorsForPlatformNotifications} from 'utils/platform_notification_activity_dates';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

import RhsNotificationCard from './rhs_notification_card';

import './rhs_notification_activity.scss';

type Props = {
    notifications: PlatformNotificationRecord[];
};

export default function RhsNotificationActivity({notifications}: Props) {
    const dispatch = useDispatch();
    const postsState = useSelector((state: GlobalState) => state.entities.posts.posts);
    const currentUser = useSelector(getCurrentUser);

    useEffect(() => {
        const missingPostIds = notifications.flatMap((record) => {
            const ids: string[] = [];
            if (!postsState[record.postId]) {
                ids.push(record.postId);
            }
            if (record.threadRootId && !postsState[record.threadRootId]) {
                ids.push(record.threadRootId);
            }
            return ids;
        });

        if (missingPostIds.length > 0) {
            dispatch(getPostsByIdsBatched([...new Set(missingPostIds)]));
        }
    }, [dispatch, notifications, postsState]);

    useEffect(() => {
        dispatch(fillPlatformNotificationActivity());
    }, [dispatch]);

    useEffect(() => {
        if (!notifications.some((record) => record.isThreadReply)) {
            return;
        }
        dispatch(reconcilePlatformNotificationActivity());
    }, [dispatch, notifications, postsState]);

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
                            defaultMessage='Notifications you receive appear here. Mark them as read when you are done.'
                        />
                    }
                />
            </div>
        );
    }

    const items = addDateSeparatorsForPlatformNotifications(notifications, postsState, currentUser);

    return (
        <div className='RhsNotificationActivity'>
            {items.map((item, index) => {
                if (typeof item === 'string' && isDateLine(item)) {
                    const date = getDateForDateLine(item);
                    return (
                        <DateSeparator
                            key={item}
                            date={date}
                        />
                    );
                }

                const previous = items[index - 1];
                const afterDate = typeof previous === 'string' && isDateLine(previous);
                const record = item as PlatformNotificationRecord;
                return (
                    <div
                        key={record.id}
                        className={classNames('RhsNotificationActivity__item', {
                            'RhsNotificationActivity__item--afterDate': afterDate,
                        })}
                    >
                        <RhsNotificationCard
                            record={record}
                        />
                    </div>
                );
            })}
        </div>
    );
}
