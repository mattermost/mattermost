// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPostsByIdsBatched} from 'mattermost-redux/actions/posts';

import {reconcilePlatformNotificationActivity} from 'actions/views/rhs';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';

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
                            defaultMessage='Notifications you receive appear here and stay until you remove them or clear the list, even after you refresh or sign in again.'
                        />
                    }
                />
            </div>
        );
    }

    return (
        <div className='RhsNotificationActivity'>
            <ul className='RhsNotificationActivity__list'>
                {notifications.map((record) => (
                    <li
                        key={record.id}
                        className='RhsNotificationActivity__item'
                    >
                        <RhsNotificationCard
                            record={record}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
