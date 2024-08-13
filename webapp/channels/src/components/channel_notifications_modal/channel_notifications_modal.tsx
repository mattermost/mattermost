// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import type {ValueType} from 'react-select';

import {BellOffOutlineIcon, RefreshIcon} from '@mattermost/compass-icons/components';
import type {Channel, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import AlertBanner from 'components/alert_banner';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';
import CheckboxWithSelectSettingItem from 'components/widgets/modals/components/checkbox_with_select_item';
import ModalHeader from 'components/widgets/modals/components/modal_header';
import ModalSection from 'components/widgets/modals/components/modal_section';
import RadioSettingItem from 'components/widgets/modals/components/radio_setting_item';
import type {Option} from 'components/widgets/modals/components/react_select_item';

import {IgnoreChannelMentions, NotificationLevels, DesktopSound} from 'utils/constants';
import {getValueOfNotificationSoundsSelect, notificationSoundKeys, stopTryNotificationRing, tryNotificationSound} from 'utils/notification_sounds';

import type {ChannelMemberNotifyProps} from './utils';
import utils, {convertDesktopSoundNotifyPropFromUserToDesktop} from './utils';

import type {PropsFromRedux} from './index';

import './channel_notifications_modal.scss';

type Props = PropsFromRedux & {

    /**
     * Function that is called when the modal has been hidden and should be removed
     */
    onExited: () => void;

    /**
     * Object with info about current channel
     */
    channel: Channel;

    /**
     * Object with info about current user
     */
    currentUser: UserProfile;
};

function getUseSameDesktopSetting(currentUserNotifyProps: UserNotifyProps, channelMemberNotifyProps?: ChannelMemberNotifyProps) {
    const isSameAsDesktop = channelMemberNotifyProps ? channelMemberNotifyProps?.desktop === channelMemberNotifyProps?.push : currentUserNotifyProps.push === currentUserNotifyProps.desktop;
    const isSameAsDesktopThreads = channelMemberNotifyProps ? channelMemberNotifyProps?.desktop_threads === channelMemberNotifyProps?.push_threads : currentUserNotifyProps.push_threads === currentUserNotifyProps.desktop_threads;
    return isSameAsDesktop && isSameAsDesktopThreads;
}

function getStateFromNotifyProps(currentUserNotifyProps: UserNotifyProps, channelMemberNotifyProps?: ChannelMemberNotifyProps) {
    let ignoreChannelMentionsDefault: ChannelNotifyProps['ignore_channel_mentions'] = IgnoreChannelMentions.OFF;

    if (channelMemberNotifyProps?.mark_unread === NotificationLevels.MENTION || (currentUserNotifyProps.channel && currentUserNotifyProps.channel === 'false')) {
        ignoreChannelMentionsDefault = IgnoreChannelMentions.ON;
    }

    let ignoreChannelMentions = channelMemberNotifyProps?.ignore_channel_mentions;
    if (!ignoreChannelMentions || ignoreChannelMentions === IgnoreChannelMentions.DEFAULT) {
        ignoreChannelMentions = ignoreChannelMentionsDefault;
    }

    const desktop = channelMemberNotifyProps?.desktop === NotificationLevels.DEFAULT ? currentUserNotifyProps.desktop : (channelMemberNotifyProps?.desktop || currentUserNotifyProps.desktop);
    const push = channelMemberNotifyProps?.push === NotificationLevels.DEFAULT ? currentUserNotifyProps.desktop : (channelMemberNotifyProps?.push || currentUserNotifyProps.push);

    let desktopSound;
    if (channelMemberNotifyProps && channelMemberNotifyProps.desktop_sound) {
        desktopSound = channelMemberNotifyProps.desktop_sound;
    } else {
        desktopSound = convertDesktopSoundNotifyPropFromUserToDesktop(currentUserNotifyProps.desktop_sound);
    }

    let desktopNotificationSound;
    if (channelMemberNotifyProps && channelMemberNotifyProps.desktop_notification_sound) {
        desktopNotificationSound = channelMemberNotifyProps.desktop_notification_sound;
    } else if (currentUserNotifyProps && currentUserNotifyProps.desktop_notification_sound) {
        desktopNotificationSound = currentUserNotifyProps.desktop_notification_sound;
    } else {
        desktopNotificationSound = notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'];
    }

    return {
        desktop,
        desktop_threads: channelMemberNotifyProps?.desktop_threads || NotificationLevels.ALL,
        desktop_sound: desktopSound,
        desktop_notification_sound: desktopNotificationSound,
        mark_unread: channelMemberNotifyProps?.mark_unread || NotificationLevels.ALL,
        push,
        push_threads: channelMemberNotifyProps?.push_threads || NotificationLevels.ALL,
        ignore_channel_mentions: ignoreChannelMentions,
        channel_auto_follow_threads: channelMemberNotifyProps?.channel_auto_follow_threads || 'off',
    };
}

type SettingsType = {
    desktop: ChannelNotifyProps['desktop'];
    desktop_threads: ChannelNotifyProps['desktop_threads'];
    desktop_sound: ChannelNotifyProps['desktop_sound'];
    desktop_notification_sound: ChannelNotifyProps['desktop_notification_sound'];
    mark_unread: ChannelNotifyProps['mark_unread'];
    push: ChannelNotifyProps['push'];
    push_threads: ChannelNotifyProps['push_threads'];
    ignore_channel_mentions: ChannelNotifyProps['ignore_channel_mentions'];
    channel_auto_follow_threads: ChannelNotifyProps['channel_auto_follow_threads'];
};

export default function ChannelNotificationsModal(props: Props) {
    const {formatMessage} = useIntl();
    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState('');
    const [mobileSettingsSameAsDesktop, setMobileSettingsSameAsDesktop] = useState<boolean>(getUseSameDesktopSetting(props.currentUser.notify_props, props.channelMember?.notify_props));
    const [settings, setSettings] = useState<SettingsType>(getStateFromNotifyProps(props.currentUser.notify_props, props.channelMember?.notify_props));

    function handleHide() {
        setShow(false);
    }

    const handleChange = useCallback((values: Record<string, string>) => {
        setSettings((prevSettings) => ({...prevSettings, ...values}));
    }, []);

    const handleMobileSettingsChange = useCallback(() => {
        setMobileSettingsSameAsDesktop((prevSettings) => !prevSettings);
        setSettings((prevSettings) => ({...prevSettings, push: prevSettings.desktop, push_threads: prevSettings.desktop_threads}));
    }, []);

    const muteOrIgnoreSectionContent = (
        <>
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='channel_notifications.muteChannelTitle'
                        defaultMessage='Mute channel'
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.muteChannelDesc',
                    defaultMessage: 'Turns off notifications for this channel. You\'ll still see badges if you\'re mentioned.',
                })}
                inputFieldValue={settings.mark_unread === 'mention'}
                inputFieldData={utils.MuteChannelInputFieldData}
                handleChange={(e) => handleChange({mark_unread: e ? 'mention' : 'all'})}
            />
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='channel_notifications.ignoreMentionsTitle'
                        defaultMessage='Ignore mentions for @channel, @here and @all'
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.ignoreMentionsDesc',
                    defaultMessage: 'When enabled, @channel, @here and @all will not trigger mentions or mention notifications in this channel',
                })}
                inputFieldValue={settings.ignore_channel_mentions === 'on'}
                inputFieldData={utils.IgnoreMentionsInputFieldData}
                handleChange={(e) => handleChange({ignore_channel_mentions: e ? 'on' : 'off'})}
            />
        </>
    );

    const handleChangeForMessageNotificationSoundSelect = (selectedOption: ValueType<Option>) => {
        stopTryNotificationRing();

        if (selectedOption && 'value' in selectedOption) {
            handleChange({desktop_notification_sound: ((selectedOption as Option).value)});
            tryNotificationSound(selectedOption.value);
        }
    };

    const desktopNotificationsSectionContent = (
        <>
            <RadioSettingItem
                title={formatMessage({
                    id: 'channel_notifications.NotifyMeTitle',
                    defaultMessage: 'Notify me about…',
                })}
                inputFieldValue={settings.desktop}
                inputFieldData={utils.desktopNotificationInputFieldData(props.currentUser.notify_props.desktop)}
                handleChange={(e) => handleChange({desktop: e.target.value})}
            />
            {props.collapsedReplyThreads && settings.desktop === 'mention' &&
                <CheckboxSettingItem
                    title={formatMessage({
                        id: 'channel_notifications.ThreadsReplyTitle',
                        defaultMessage: 'Thread reply notifications',
                    })}
                    inputFieldValue={settings.desktop_threads === 'all'}
                    inputFieldData={utils.DesktopReplyThreadsInputFieldData}
                    inputFieldTitle={
                        <FormattedMessage
                            id='channel_notifications.checkbox.threadsReplyTitle'
                            defaultMessage="Notify me about replies to threads I\'m following"
                        />
                    }
                    handleChange={(e) => handleChange({desktop_threads: e ? 'all' : 'mention'})}
                />
            }
            {settings.desktop !== 'none' && (
                <CheckboxWithSelectSettingItem
                    title={formatMessage({
                        id: 'channel_notifications.desktopNotifications.title',
                        defaultMessage: 'Sounds',
                    })}
                    checkboxFieldTitle={
                        <FormattedMessage
                            id='channel_notifications.desktopNotifications.soundEnable'
                            defaultMessage='Message notification sounds'
                        />
                    }
                    checkboxFieldValue={settings.desktop_sound === DesktopSound.ON}
                    checkboxFieldData={utils.desktopNotificationSoundsCheckboxFieldData}
                    handleCheckboxChange={(isChecked) => handleChange({desktop_sound: isChecked ? DesktopSound.ON : DesktopSound.OFF})}
                    selectFieldData={utils.desktopNotificationSoundsSelectFieldData}
                    selectFieldValue={getValueOfNotificationSoundsSelect(settings.desktop_notification_sound)}
                    isSelectDisabled={settings.desktop_sound !== 'on'}
                    selectPlaceholder={formatMessage({
                        id: 'channel_notifications.desktopNotifications.soundSelectPlaceholder',
                        defaultMessage: 'Select a sound',
                    })}
                    handleSelectChange={handleChangeForMessageNotificationSoundSelect}
                />
            )}
        </>
    );

    const mobileNotificationsSectionContent = (
        <>
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='channel_notifications.checkbox.sameMobileSettingsDesktop'
                        defaultMessage='Use the same notification settings as desktop'
                    />
                }
                inputFieldValue={mobileSettingsSameAsDesktop}
                inputFieldData={utils.sameMobileSettingsDesktopInputFieldData}
                handleChange={() => handleMobileSettingsChange()}
            />
            {!mobileSettingsSameAsDesktop && (
                <>
                    <RadioSettingItem
                        title={formatMessage({
                            id: 'channel_notifications.NotifyMeTitle',
                            defaultMessage: 'Notify me about…',
                        })}
                        inputFieldValue={settings.push}
                        inputFieldData={utils.mobileNotificationInputFieldData(props.currentUser.notify_props.push)}
                        handleChange={(e) => handleChange({push: e.target.value})}
                    />
                    {props.collapsedReplyThreads && settings.push === 'mention' &&
                    <CheckboxSettingItem
                        title={formatMessage({
                            id: 'channel_notifications.ThreadsReplyTitle',
                            defaultMessage: 'Thread reply notifications',
                        })}
                        inputFieldTitle={
                            <FormattedMessage
                                id='channel_notifications.checkbox.threadsReplyTitle'
                                defaultMessage="Notify me about replies to threads I\'m following"
                            />
                        }
                        inputFieldValue={settings.push_threads === 'all'}
                        inputFieldData={utils.MobileReplyThreadsInputFieldData}
                        handleChange={(e) => handleChange({push_threads: e ? 'all' : 'mention'})}
                    />}
                </>
            )}
        </>
    );

    const autoFollowThreadsSectionContent = (
        <CheckboxSettingItem
            inputFieldTitle={
                <FormattedMessage
                    id='channel_notifications.checkbox.autoFollowThreadsTitle'
                    defaultMessage='Automatically follow threads in this channel'
                />
            }
            inputFieldValue={settings.channel_auto_follow_threads === 'on'}
            inputFieldData={utils.AutoFollowThreadsInputFieldData}
            handleChange={(e) => handleChange({channel_auto_follow_threads: e ? 'on' : 'off'})}
        />
    );

    function handleSave() {
        const userSettings: Partial<SettingsType> = {...settings};
        if (!props.collapsedReplyThreads) {
            delete userSettings.push_threads;
            delete userSettings.desktop_threads;
            delete userSettings.channel_auto_follow_threads;
        }
        props.actions.updateChannelNotifyProps(props.currentUser.id, props.channel.id, userSettings).then((value) => {
            const {error} = value;
            if (error) {
                setServerError(error.message);
            } else {
                handleHide();
            }
        });
    }

    const resetToDefaultBtn = useCallback((sectionName: string) => {
        const userNotifyProps = {
            ...props.currentUser.notify_props,
            desktop_notification_sound: props.currentUser.notify_props?.desktop_notification_sound ?? notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'],
        };

        function resetToDefault(sectionName: string) {
            if (sectionName === 'desktop') {
                setSettings({
                    ...settings,
                    desktop: userNotifyProps.desktop,
                    desktop_threads: userNotifyProps.desktop_threads || settings.desktop_threads,
                    desktop_sound: convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps.desktop_sound),
                    desktop_notification_sound: userNotifyProps?.desktop_notification_sound ?? notificationSoundKeys[0] as ChannelNotifyProps['desktop_notification_sound'],
                });
            }

            if (sectionName === 'push') {
                setSettings({...settings, push: userNotifyProps.desktop, push_threads: userNotifyProps.push_threads || settings.push_threads});
            }
        }

        const isDesktopSameAsDefault =
            userNotifyProps.desktop === settings.desktop &&
            userNotifyProps.desktop_threads === settings.desktop_threads &&
            userNotifyProps.desktop_notification_sound === settings.desktop_notification_sound &&
            convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps.desktop_sound) === settings.desktop_sound;

        const isPushSameAsDefault = (userNotifyProps.push === settings.push && userNotifyProps.push_threads === settings.push_threads);

        if ((sectionName === 'desktop' && isDesktopSameAsDefault) || (sectionName === 'push' && isPushSameAsDefault)) {
            return undefined;
        }

        return (
            <button
                className='channel-notifications-settings-modal__reset-btn'
                onClick={() => resetToDefault(sectionName)}
                data-testid={`resetToDefaultButton-${sectionName}`}
            >
                <RefreshIcon
                    size={14}
                    color={'currentColor'}
                />
                <FormattedMessage
                    id='channel_notifications.resetToDefault'
                    defaultMessage='Reset to default'
                />
            </button>
        );
    }, [props.currentUser.notify_props, settings]);

    const desktopAndMobileNotificationSectionContent = settings.mark_unread === 'all' ? (
        <>
            <div className='channel-notifications-settings-modal__divider'/>
            <ModalSection
                title={formatMessage({
                    id: 'channel_notifications.desktopNotificationsTitle',
                    defaultMessage: 'Desktop Notifications',
                })}
                titleSuffix={resetToDefaultBtn('desktop')}
                description={formatMessage({
                    id: 'channel_notifications.desktopNotificationsDesc',
                    defaultMessage: 'Available on Chrome, Edge, Firefox, and the Mattermost Desktop App.',
                })}
                content={desktopNotificationsSectionContent}
            />
            <div className='channel-notifications-settings-modal__divider'/>
            <ModalSection
                title={formatMessage({
                    id: 'channel_notifications.mobileNotificationsTitle',
                    defaultMessage: 'Mobile Notifications',
                })}
                titleSuffix={resetToDefaultBtn('push')}
                description={formatMessage({
                    id: 'channel_notifications.mobileNotificationsDesc',
                    defaultMessage: 'Notification alerts are pushed to your mobile device when there is activity in Mattermost.',
                })}
                content={mobileNotificationsSectionContent}
            />
        </>
    ) : (
        <AlertBanner
            id='channelNotificationsMutedBanner'
            mode='info'
            variant='app'
            customIcon={
                <BellOffOutlineIcon
                    size={24}
                    color={'currentColor'}
                />
            }
            title={
                <FormattedMessage
                    id='channel_notifications.alertBanner.title'
                    defaultMessage='This channel is muted'
                />
            }
            message={
                <FormattedMessage
                    id='channel_notifications.alertBanner.description'
                    defaultMessage='All other notification preferences for this channel are disabled'
                />
            }
        />
    );

    return (
        <Modal
            dialogClassName='a11y__modal channel-notifications-settings-modal'
            show={show}
            onHide={handleHide}
            onExited={props.onExited}
            role='dialog'
            aria-labelledby='channelNotificationModalLabel'
            style={{display: 'flex', placeItems: 'center'}}
        >
            <ModalHeader
                id={'channelNotificationModalLabel'}
                title={formatMessage({
                    id: 'channel_notifications.preferences',
                    defaultMessage: 'Notification Preferences',
                })}
                subtitle={props.channel.display_name}
                handleClose={handleHide}
            />
            <main className='channel-notifications-settings-modal__body'>
                <ModalSection
                    title={formatMessage({
                        id: 'channel_notifications.muteAndIgnore',
                        defaultMessage: 'Mute or ignore',
                    })}
                    content={muteOrIgnoreSectionContent}
                />
                {desktopAndMobileNotificationSectionContent}
                {props.collapsedReplyThreads &&
                    <>
                        <div className='channel-notifications-settings-modal__divider'/>
                        <ModalSection
                            title={formatMessage({
                                id: 'channel_notifications.autoFollowThreadsTitle',
                                defaultMessage: 'Follow all threads in this channel',
                            })}
                            description={formatMessage({
                                id: 'channel_notifications.autoFollowThreadsDesc',
                                defaultMessage: 'When enabled, all new replies in this channel will be automatically followed and will appear in your Threads view.',
                            })}
                            content={autoFollowThreadsSectionContent}
                        />
                    </>
                }
            </main>
            <footer className='channel-notifications-settings-modal__footer'>
                {serverError &&
                    <span className='channel-notifications-settings-modal__server-error'>
                        {serverError}
                    </span>
                }
                <button
                    className='btn btn-tertiary btn-md'
                    onClick={handleHide}
                >
                    <FormattedMessage
                        id='generic_btn.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    className='btn btn-primary btn-md'
                    onClick={handleSave}
                >
                    <FormattedMessage
                        id='generic_btn.save'
                        defaultMessage='Save'
                    />
                </button>
            </footer>
        </Modal>
    );
}

