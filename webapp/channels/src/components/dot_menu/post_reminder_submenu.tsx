// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import {FormattedMessage, FormattedDate, FormattedTime, useIntl} from 'react-intl';
import {ChevronRightIcon, ClockOutlineIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';
import {getCurrentMomentForTimezone} from 'utils/timezone';
import {openModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import {toUTCUnix} from 'utils/datetime';
import PostReminderCustomTimePicker from 'components/post_reminder_custom_time_picker_modal';
import {addPostReminder} from 'mattermost-redux/actions/posts';
import {t} from 'utils/i18n';

import {Post} from '@mattermost/types/posts';

type Props = {
    userId: string;
    post: Post;
    isMilitaryTime: boolean;
    timezone?: string;
}

const postReminderTimes = [
    {id: 'thirty_minutes', label: t('post_info.post_reminder.sub_menu.thirty_minutes'), labelDefault: '30 mins'},
    {id: 'one_hour', label: t('post_info.post_reminder.sub_menu.one_hour'), labelDefault: '1 hour'},
    {id: 'two_hours', label: t('post_info.post_reminder.sub_menu.two_hours'), labelDefault: '2 hours'},
    {id: 'tomorrow', label: t('post_info.post_reminder.sub_menu.tomorrow'), labelDefault: 'Tomorrow'},
    {id: 'custom', label: t('post_info.post_reminder.sub_menu.custom'), labelDefault: 'Custom'},
];

export function PostReminderSubmenu(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const setPostReminder = (id: string): void => {
        const currentDate = getCurrentMomentForTimezone(props.timezone);
        let endTime = currentDate;
        switch (id) {
        case 'thirty_minutes':
            // add 30 minutes in current time
            endTime = currentDate.add(30, 'minutes');
            break;
        case 'one_hour':
            // add 1 hour in current time
            endTime = currentDate.add(1, 'hour');
            break;
        case 'two_hours':
            // add 2 hours in current time
            endTime = currentDate.add(2, 'hours');
            break;
        case 'tomorrow':
            // add one day in current date
            endTime = currentDate.add(1, 'day');
            break;
        }

        dispatch(addPostReminder(props.userId, props.post.id, toUTCUnix(endTime.toDate())));
    };

    const setCustomPostReminder = (): void => {
        const postReminderCustomTimePicker = {
            modalId: ModalIdentifiers.POST_REMINDER_CUSTOM_TIME_PICKER,
            dialogType: PostReminderCustomTimePicker,
            dialogProps: {
                postId: props.post.id,
            },
        };
        dispatch(openModal(postReminderCustomTimePicker));
    };

    const postReminderSubMenuItems =
        postReminderTimes.map(({id, label, labelDefault}) => {
            const labels = (
                <FormattedMessage
                    id={label}
                    defaultMessage={labelDefault}
                />
            );

            let trailing: React.ReactNode;
            if (id === 'tomorrow') {
                const tomorrow = getCurrentMomentForTimezone(props.timezone).add(1, 'day').toDate();
                trailing = (
                    <span className={`postReminder-${id}_timestamp`}>
                        <FormattedDate
                            value={tomorrow}
                            weekday='short'
                            timeZone={props.timezone}
                        />
                        {', '}
                        <FormattedTime
                            value={tomorrow}
                            timeStyle='short'
                            hour12={!props.isMilitaryTime}
                            timeZone={props.timezone}
                        />
                    </span>
                );
            }
            return (
                <Menu.Item
                    key={`remind_post_options_${id}`}
                    id={`remind_post_options_${id}`}
                    labels={labels}
                    trailingElements={trailing}
                    onClick={id === 'custom' ? () => setCustomPostReminder() : () => setPostReminder(id)}
                />
            );
        });

    return (
        <Menu.SubMenu
            id={`remind_post_${props.post.id}`}
            labels={
                <FormattedMessage
                    id='post_info.post_reminder.menu'
                    defaultMessage='Remind'
                />
            }
            leadingElement={<ClockOutlineIcon size={18}/>}
            trailingElements={<span className={'dot-menu__item-trailing-icon'}><ChevronRightIcon size={16}/></span>}
            menuId={`remind_post_${props.post.id}-menu`}
        >
            <h5 className={'dot-menu__post-reminder-menu-header'}>
                {formatMessage(
                    {id: 'post_info.post_reminder.sub_menu.header',
                        defaultMessage: 'Set a reminder for:'},
                )}
            </h5>
            {postReminderSubMenuItems}
        </Menu.SubMenu>
    );
}
