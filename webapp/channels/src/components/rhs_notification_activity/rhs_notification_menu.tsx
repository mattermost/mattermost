// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {DotsVerticalIcon} from '@mattermost/compass-icons/components';

import {
    clearPlatformNotificationRecord,
    markPlatformNotificationAsRead,
} from 'actions/views/rhs';

import * as Menu from 'components/menu';

import type {PlatformNotificationRecord} from 'types/store/rhs';

type Props = {
    record: PlatformNotificationRecord;
};

export default function RhsNotificationMenu({record}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const handleMarkAsRead = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        dispatch(markPlatformNotificationAsRead(record));
    }, [dispatch, record]);

    const handleRemove = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        dispatch(clearPlatformNotificationRecord(record.id));
    }, [dispatch, record.id]);

    const handleMenuToggle = useCallback((isOpen: boolean) => {
        if (isOpen) {
            return;
        }

        const menuButton = document.getElementById(`notification-activity-menu-${record.id}`);
        if (menuButton instanceof HTMLElement && document.activeElement === menuButton) {
            menuButton.blur();
        }
    }, [record.id]);

    return (
        <Menu.Container
            menuButton={{
                id: `notification-activity-menu-${record.id}`,
                class: 'btn btn-icon btn-sm',
                'aria-label': formatMessage({
                    id: 'rhs_notification_activity.menu.label',
                    defaultMessage: 'Notification actions',
                }),
                children: (
                    <DotsVerticalIcon size={18}/>
                ),
            }}
            menu={{
                id: `notification-activity-menu-dropdown-${record.id}`,
                onToggle: handleMenuToggle,
            }}
        >
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='rhs_notification_activity.menu.mark_read'
                        defaultMessage='Mark as read'
                    />
                }
                onClick={handleMarkAsRead}
            />
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='rhs_notification_activity.menu.remove'
                        defaultMessage='Remove notification'
                    />
                }
                onClick={handleRemove}
            />
        </Menu.Container>
    );
}
