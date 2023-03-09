// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {IgnoreChannelMentions, NotificationLevels, NotificationSections} from 'utils/constants';

import SettingItemMax from 'components/setting_item_max';

import Describe from './describe';
import ExtraInfo from './extra_info';
import SectionTitle from './section_title';

type Props = {
    ignoreChannelMentions?: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onChangeThreads?: (e: ChangeEvent<HTMLInputElement>) => void;
    onCollapseSection: (section: string) => void;
    onSubmit: (setting?: string) => void;
    globalNotifyLevel?: string;
    memberNotifyLevel: string;
    memberThreadsNotifyLevel?: string;
    section: string;
    serverError?: string;
}

export default function ExpandView({
    section,
    memberNotifyLevel,
    memberThreadsNotifyLevel,
    globalNotifyLevel,
    onChange,
    onChangeThreads,
    onSubmit,
    serverError,
    onCollapseSection,
    ignoreChannelMentions,
}: Props) {
    const isCRTEnabled = useSelector(isCollapsedThreadsEnabled);

    const inputs = [(
        <div key='channel-notification-level-radio'>
            {(section === NotificationSections.DESKTOP || section === NotificationSections.PUSH) &&
            <fieldset>
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationGlobalDefault'
                            name='channelDesktopNotifications'
                            type='radio'
                            value={NotificationLevels.DEFAULT}
                            checked={memberNotifyLevel === NotificationLevels.DEFAULT}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.DEFAULT}
                            globalNotifyLevel={globalNotifyLevel}
                        />
                    </label>
                </div>
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationAllActivity'
                            name='channelDesktopNotifications'
                            type='radio'
                            value={NotificationLevels.ALL}
                            checked={memberNotifyLevel === NotificationLevels.ALL}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.ALL}
                        />
                    </label>
                </div>
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationMentions'
                            name='channelDesktopNotifications'
                            type='radio'
                            value={NotificationLevels.MENTION}
                            checked={memberNotifyLevel === NotificationLevels.MENTION}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.MENTION}
                        />
                    </label>
                </div>
                <div className='radio'>
                    <label>
                        <input
                            id='channelNotificationNever'
                            name='channelDesktopNotifications'
                            type='radio'
                            value={NotificationLevels.NONE}
                            checked={memberNotifyLevel === NotificationLevels.NONE}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.NONE}
                        />
                    </label>
                </div>
            </fieldset>
            }
            {section === NotificationSections.IGNORE_CHANNEL_MENTIONS &&
                <fieldset>
                    <div className='radio'>
                        <label>
                            <input
                                id='ignoreChannelMentionsOn'
                                name='ignoreChannelMentions'
                                type='radio'
                                value={IgnoreChannelMentions.ON}
                                checked={ignoreChannelMentions === IgnoreChannelMentions.ON}
                                onChange={onChange}
                            />
                            <Describe
                                section={section}
                                ignoreChannelMentions={IgnoreChannelMentions.ON}
                                memberNotifyLevel={memberNotifyLevel}
                                globalNotifyLevel={globalNotifyLevel}
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='ignoreChannelMentionsOff'
                                name='ignoreChannelMentions'
                                type='radio'
                                value={IgnoreChannelMentions.OFF}
                                checked={ignoreChannelMentions === IgnoreChannelMentions.OFF}
                                onChange={onChange}
                            />
                            <Describe
                                section={section}
                                ignoreChannelMentions={IgnoreChannelMentions.OFF}
                                memberNotifyLevel={memberNotifyLevel}
                                globalNotifyLevel={globalNotifyLevel}
                            />
                        </label>
                    </div>
                </fieldset>
            }
            {section === NotificationSections.MARK_UNREAD &&
            <fieldset>
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationUnmute'
                            name='channelNotificationMute'
                            type='radio'
                            value={NotificationLevels.MENTION}
                            checked={memberNotifyLevel === NotificationLevels.MENTION}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.MENTION}
                        />
                    </label>
                </div>
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationMute'
                            name='channelNotificationMute'
                            type='radio'
                            value={NotificationLevels.ALL}
                            checked={memberNotifyLevel === NotificationLevels.ALL}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.ALL}
                        />
                    </label>
                </div>
            </fieldset>
            }
            <div className='mt-5'>
                <ExtraInfo section={section}/>
            </div>

            {isCRTEnabled &&
            section === NotificationSections.DESKTOP &&
            memberNotifyLevel === NotificationLevels.MENTION &&
            <>
                <hr/>
                <fieldset>
                    <legend className='form-legend'>
                        <FormattedMessage
                            id='user.settings.notifications.threads.desktop'
                            defaultMessage='Thread reply notifications'
                        />
                    </legend>
                    <div className='checkbox'>
                        <label>
                            <input
                                id='desktopThreadsNotificationAllActivity'
                                type='checkbox'
                                name='desktopThreadsNotificationLevel'
                                checked={memberThreadsNotifyLevel === NotificationLevels.ALL}
                                onChange={onChangeThreads}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.threads.allActivity'
                                defaultMessage={'Notify me about threads I\'m following'}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='mt-5'>
                        <FormattedMessage
                            id='user.settings.notifications.threads'
                            defaultMessage={'When enabled, any reply to a thread you\'re following will send a desktop notification.'}
                        />
                    </div>
                </fieldset>
            </>
            }
            {isCRTEnabled &&
            section === NotificationSections.PUSH &&
            memberNotifyLevel === NotificationLevels.MENTION &&
            <>
                <hr/>
                <fieldset>
                    <legend className='form-legend'>
                        <FormattedMessage
                            id='user.settings.notifications.threads.push'
                            defaultMessage='Thread reply notifications'
                        />
                    </legend>
                    <div className='checkbox'>
                        <label>
                            <input
                                id='pushThreadsNotificationAllActivity'
                                type='checkbox'
                                name='pushThreadsNotificationLevel'
                                checked={memberThreadsNotifyLevel === NotificationLevels.ALL}
                                onChange={onChangeThreads}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.push_threads.allActivity'
                                defaultMessage={'Notify me about threads I\'m following'}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='mt-5'>
                        <FormattedMessage
                            id='user.settings.notifications.push_threads'
                            defaultMessage={'When enabled, any reply to a thread you\'re following will send a mobile push notification.'}
                        />
                    </div>
                </fieldset>
            </>
            }
        </div>
    )];

    return (
        <SettingItemMax
            title={<SectionTitle section={section}/>}
            inputs={inputs}
            submit={onSubmit}
            serverError={serverError}
            updateSection={onCollapseSection}
        />
    );
}
