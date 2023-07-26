// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, useMemo, useRef, ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import ReactSelect, {ValueType} from 'react-select';

import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {ChannelAutoFollowThreads, DesktopSound, IgnoreChannelMentions, NotificationLevels, NotificationSections} from 'utils/constants';

import SettingItemMax from 'components/setting_item_max';

import {ChannelNotifyProps} from '@mattermost/types/channels';

import {notificationSounds} from 'utils/notification_sounds';

import Describe from './describe';
import ExtraInfo from './extra_info';
import SectionTitle from './section_title';

type SelectedOption = {
    label: string;
    value: string;
};

type Props = {
    ignoreChannelMentions?: string;
    channelAutoFollowThreads?: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onChangeThreads?: (e: ChangeEvent<HTMLInputElement>) => void;
    onChangeDesktopSound?: (e: ChangeEvent<HTMLInputElement>) => void;
    onChangeNotificationSound?: (selectedOption: ValueType<SelectedOption>) => void;
    onCollapseSection: (section: string) => void;
    onReset?: () => void;
    onSubmit: (setting?: string) => void;
    isNotificationsSettingSameAsGlobal?: boolean;
    globalNotifyLevel?: string;
    globalNotificationSound?: ChannelNotifyProps['desktop_notification_sound'];
    memberNotifyLevel: string;
    memberThreadsNotifyLevel?: string;
    memberDesktopSound?: string;
    memberDesktopNotificationSound?: string;
    section: string;
    serverError?: ReactNode;
}

const sounds = Array.from(notificationSounds.keys());

const makeDefaultOptionLabel = (option: string) => `${option} (default)`;

const makeReactSelectValue = (option: string, isDefault: boolean) => {
    return {value: option, label: isDefault ? makeDefaultOptionLabel(option) : option};
};

export default function ExpandView({
    section,
    memberNotifyLevel,
    memberThreadsNotifyLevel,
    memberDesktopSound,
    memberDesktopNotificationSound,
    globalNotifyLevel,
    globalNotificationSound,
    isNotificationsSettingSameAsGlobal,
    onChange,
    onChangeThreads,
    onChangeDesktopSound,
    onChangeNotificationSound,
    onReset,
    onSubmit,
    serverError,
    onCollapseSection,
    ignoreChannelMentions,
    channelAutoFollowThreads,
}: Props) {
    const isCRTEnabled = useSelector(isCollapsedThreadsEnabled);

    const soundOptions = useMemo(() => sounds.map((sound) => {
        return {value: sound, label: sound === globalNotificationSound ? makeDefaultOptionLabel(sound) : sound};
    }), [globalNotificationSound]);

    const dropdownSoundRef = useRef<ReactSelect>(null);

    const inputs = [(
        <div key='channel-notification-level-radio'>
            {(section === NotificationSections.DESKTOP || section === NotificationSections.PUSH) &&
            <fieldset>
                { section === NotificationSections.DESKTOP && <legend className='form-legend'>
                    <FormattedMessage
                        id='channel_notifications.sendDesktop'
                        defaultMessage='Send desktop notifications'
                    />
                </legend>}
                { section === NotificationSections.PUSH && <legend className='form-legend'>
                    <FormattedMessage
                        id='channel_notifications.sendMobilePush'
                        defaultMessage='Send mobile push notifications'
                    />
                </legend>}
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationAllActivity'
                            name='channelNotifications'
                            type='radio'
                            value={NotificationLevels.ALL}
                            checked={memberNotifyLevel === NotificationLevels.ALL}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.ALL}
                            globalNotifyLevel={globalNotifyLevel}
                        />
                    </label>
                </div>
                <div className='radio'>
                    <label className=''>
                        <input
                            id='channelNotificationMentions'
                            name='channelNotifications'
                            type='radio'
                            value={NotificationLevels.MENTION}
                            checked={memberNotifyLevel === NotificationLevels.MENTION}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.MENTION}
                            globalNotifyLevel={globalNotifyLevel}
                        />
                    </label>
                </div>
                <div className='radio'>
                    <label>
                        <input
                            id='channelNotificationNever'
                            name='channelNotifications'
                            type='radio'
                            value={NotificationLevels.NONE}
                            checked={memberNotifyLevel === NotificationLevels.NONE}
                            onChange={onChange}
                        />
                        <Describe
                            section={section}
                            memberNotifyLevel={NotificationLevels.NONE}
                            globalNotifyLevel={globalNotifyLevel}
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
            {section === NotificationSections.CHANNEL_AUTO_FOLLOW_THREADS &&
                <fieldset>
                    <div className='radio'>
                        <label>
                            <input
                                id='channelAutoFollowThreadsOn'
                                name='channelAutoFollowThreads'
                                type='radio'
                                value={ChannelAutoFollowThreads.ON}
                                checked={channelAutoFollowThreads === ChannelAutoFollowThreads.ON}
                                onChange={onChange}
                            />
                            <Describe
                                section={section}
                                channelAutoFollowThreads={ChannelAutoFollowThreads.ON}
                                memberNotifyLevel={memberNotifyLevel}
                                globalNotifyLevel={globalNotifyLevel}
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='channelAutoFollowThreadsOff'
                                name='channelAutoFollowThreads'
                                type='radio'
                                value={ChannelAutoFollowThreads.OFF}
                                checked={channelAutoFollowThreads === ChannelAutoFollowThreads.OFF}
                                onChange={onChange}
                            />
                            <Describe
                                section={section}
                                channelAutoFollowThreads={ChannelAutoFollowThreads.OFF}
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
            {(section === NotificationSections.DESKTOP) && memberNotifyLevel !== NotificationLevels.NONE &&

            <>
                <hr/>
                <fieldset>
                    <legend className='form-legend'>
                        <FormattedMessage
                            id='channel_notifications.sound'
                            defaultMessage='Notification sound'
                        />
                    </legend>
                    <div className='radio'>
                        <label className=''>
                            <input
                                id='channelDesktopSoundOn'
                                name='channelDesktopSound'
                                type='radio'
                                value={DesktopSound.ON}
                                checked={memberDesktopSound === DesktopSound.ON}
                                onChange={onChangeDesktopSound}
                            />
                            <FormattedMessage
                                id='channel_notifications.sound.on.title'
                                defaultMessage='On'
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='channelDesktopSoundOff'
                                name='channelDesktopSound'
                                type='radio'
                                value={DesktopSound.OFF}
                                checked={memberDesktopSound === DesktopSound.OFF}
                                onChange={onChangeDesktopSound}
                            />
                            <FormattedMessage
                                id='channel_notifications.sound.off.title'
                                defaultMessage='Off'
                            />
                        </label>
                    </div>
                    {memberDesktopSound === DesktopSound.ON &&
                    <div className='pt-2'>
                        <ReactSelect
                            className='react-select notification-sound-dropdown'
                            classNamePrefix='react-select'
                            id='channelSoundNotification'
                            options={soundOptions}
                            clearable={false}
                            onChange={onChangeNotificationSound}
                            value={makeReactSelectValue(memberDesktopNotificationSound ?? '', memberDesktopNotificationSound === globalNotificationSound)}
                            isSearchable={false}
                            ref={dropdownSoundRef}
                        />
                    </div>}
                    <div className='mt-5'>
                        <FormattedMessage
                            id='channel_notifications.sound_info'
                            defaultMessage='Notification sounds are available on Firefox, Edge, Safari, Chrome and Mattermost Desktop Apps.'
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
            title={
                <SectionTitle
                    section={section}
                    isExpanded={true}
                    isNotificationsSettingSameAsGlobal={isNotificationsSettingSameAsGlobal}
                    onClickResetButton={onReset}
                />}
            inputs={inputs}
            submit={onSubmit}
            serverError={serverError}
            updateSection={onCollapseSection}
        />
    );
}
