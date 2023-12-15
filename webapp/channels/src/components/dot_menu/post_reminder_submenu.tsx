// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, FormattedDate, FormattedTime, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {ChevronRightIcon, ClockOutlineIcon} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';

import {addPostReminder} from 'mattermost-redux/actions/posts';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import PostReminderCustomTimePicker from 'components/post_reminder_custom_time_picker_modal';

import {ModalIdentifiers} from 'utils/constants';
import {toUTCUnix} from 'utils/datetime';
import {getCurrentMomentForTimezone} from 'utils/timezone';

type Props = {
    userId: string;
    post: Post;
    isMilitaryTime: boolean;
    timezone?: string;
}

const PostReminders = {
    THIRTY_MINUTES: 'thirty_minutes',
    ONE_HOUR: 'one_hour',
    TWO_HOURS: 'two_hours',
    TOMORROW: 'tomorrow',
    CUSTOM: 'custom',
} as const;

function PostReminderSubmenu(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    function handlePostReminderMenuClick(id: string) {
        if (id === PostReminders.CUSTOM) {
            const postReminderCustomTimePicker = {
                modalId: ModalIdentifiers.POST_REMINDER_CUSTOM_TIME_PICKER,
                dialogType: PostReminderCustomTimePicker,
                dialogProps: {
                    postId: props.post.id,
                },
            };

            dispatch(openModal(postReminderCustomTimePicker));
        } else {
            const currentDate = getCurrentMomentForTimezone(props.timezone);

            let endTime = currentDate;
            if (id === PostReminders.THIRTY_MINUTES) {
                // add 30 minutes in current time
                endTime = currentDate.add(30, 'minutes');
            } else if (id === PostReminders.ONE_HOUR) {
                // add 1 hour in current time
                endTime = currentDate.add(1, 'hour');
            } else if (id === PostReminders.TWO_HOURS) {
                // add 2 hours in current time
                endTime = currentDate.add(2, 'hours');
            } else if (id === PostReminders.TOMORROW) {
                // set to next day 9 in the morning
                endTime = currentDate.add(1, 'day').set({hour: 9, minute: 0});
            }

            dispatch(addPostReminder(props.userId, props.post.id, toUTCUnix(endTime.toDate())));
        }
    }

    const postReminderSubMenuItems = Object.values(PostReminders).map((postReminder) => {
        let labels = null;
        if (postReminder === PostReminders.THIRTY_MINUTES) {
            labels = (
                <FormattedMessage
                    id='post_info.post_reminder.sub_menu.thirty_minutes'
                    defaultMessage='30 mins'
                />
            );
        } else if (postReminder === PostReminders.ONE_HOUR) {
            labels = (
                <FormattedMessage
                    id='post_info.post_reminder.sub_menu.one_hour'
                    defaultMessage='1 hour'
                />
            );
        } else if (postReminder === PostReminders.TWO_HOURS) {
            labels = (
                <FormattedMessage
                    id='post_info.post_reminder.sub_menu.two_hours'
                    defaultMessage='2 hours'
                />
            );
        } else if (postReminder === PostReminders.TOMORROW) {
            labels = (
                <FormattedMessage
                    id='post_info.post_reminder.sub_menu.tomorrow'
                    defaultMessage='Tomorrow'
                />
            );
        } else {
            labels = (
                <FormattedMessage
                    id='post_info.post_reminder.sub_menu.custom'
                    defaultMessage='Custom'
                />
            );
        }

        let trailingElements = null;
        if (postReminder === PostReminders.TOMORROW) {
            const tomorrow = getCurrentMomentForTimezone(props.timezone).add(1, 'day').set({hour: 9, minute: 0}).toDate();

            trailingElements = (
                <span className={`postReminder-${postReminder}_timestamp`}>
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
                id={`remind_post_options_${postReminder}`}
                key={`remind_post_options_${postReminder}`}
                labels={labels}
                trailingElements={trailingElements}
                onClick={() => handlePostReminderMenuClick(postReminder)}
            />
        );
    });

    return (
        <Menu.SubMenu
            id={`remind_post_${props.post.id}`}
            menuAriaLabel={formatMessage({
                id: 'post_info.post_reminder.sub_menu.header',
                defaultMessage: 'Set a reminder for:',
            })}
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

export default memo(PostReminderSubmenu);
