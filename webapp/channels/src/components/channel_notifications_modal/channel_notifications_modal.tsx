// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {OnChangeValue} from 'react-select';

import {BellOffOutlineIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import AlertBanner from 'components/alert_banner';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';
import CheckboxWithSelectSettingItem from 'components/widgets/modals/components/checkbox_with_select_item';
import ModalHeader from 'components/widgets/modals/components/modal_header';
import ModalSection from 'components/widgets/modals/components/modal_section';
import RadioSettingItem from 'components/widgets/modals/components/radio_setting_item';
import type {Option} from 'components/widgets/modals/components/react_select_item';

import {focusElement} from 'utils/a11y_utils';
import {NotificationLevels, DesktopSound, IgnoreChannelMentions} from 'utils/constants';
import {convertDesktopSoundNotifyPropFromUserToDesktop, DesktopNotificationSounds, getValueOfNotificationSoundsSelect, stopTryNotificationRing, tryNotificationSound} from 'utils/notification_sounds';

import ResetToDefaultButton, {SectionName} from './reset_to_default_button';
import utils from './utils';

import type {PropsFromRedux} from './index';

import './channel_notifications_modal.scss';

export type Props = PropsFromRedux & {

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

    /**
     * Id of the element that triggered the modal opening
     */
    focusOriginElement?: string;
};

export default function ChannelNotificationsModal(props: Props) {
    const {formatMessage} = useIntl();

    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState('');

    const [settings, setSettings] = useState(getStateFromNotifyProps(props.currentUser.notify_props, props.channelMember?.notify_props));

    const [desktopAndMobileSettingsDifferent, setDesktopAndMobileSettingDifferent] = useState<boolean>(areDesktopAndMobileSettingsDifferent(
        props.collapsedReplyThreads,
        getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, props?.channelMember?.notify_props?.desktop, props.currentUser.notify_props.desktop),
        getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, props?.channelMember?.notify_props?.desktop_threads, props.currentUser.notify_props.desktop_threads),
        getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, props?.channelMember?.notify_props?.push, props.currentUser.notify_props.push),
        getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, props?.channelMember?.notify_props?.push_threads, props.currentUser.notify_props.push_threads),
    ));

    function handleHide() {
        setShow(false);
    }

    function handleExited() {
        if (props.focusOriginElement) {
            focusElement(props.focusOriginElement, true);
        }
        props.onExited?.();
    }

    const handleChange = useCallback((values: Record<string, string>) => {
        setSettings((prevSettings) => ({...prevSettings, ...values}));
    }, []);

    function handleUseSameMobileSettingsAsDesktopCheckboxChange(value: boolean) {
        const newValueOfSettings = {...settings};
        const newValueOfDesktopAndMobileSettingsDifferent = !value;

        if (newValueOfDesktopAndMobileSettingsDifferent === false) {
            newValueOfSettings.push = settings.desktop;
            newValueOfSettings.push_threads = settings.desktop_threads;
        } else {
            newValueOfSettings.push = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, props.channelMember?.notify_props?.push, props.currentUser?.notify_props?.push);
            newValueOfSettings.push_threads = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, props.channelMember?.notify_props?.push_threads, props.currentUser?.notify_props?.push_threads);
        }
        setSettings(newValueOfSettings);
        setDesktopAndMobileSettingDifferent(newValueOfDesktopAndMobileSettingsDifferent);
    }

    function handleResetToDefaultClicked(channelNotifyPropsDefaultedToUserNotifyProps: ChannelMembership['notify_props'], sectionName: SectionName) {
        if (sectionName === SectionName.Mobile) {
            const desktopAndMobileSettingsDiff = areDesktopAndMobileSettingsDifferent(
                props.collapsedReplyThreads,
                settings.desktop,
                settings.desktop_threads,
                channelNotifyPropsDefaultedToUserNotifyProps.push,
                channelNotifyPropsDefaultedToUserNotifyProps.push_threads,
            );

            setDesktopAndMobileSettingDifferent(desktopAndMobileSettingsDiff);
        }

        setSettings({...settings, ...channelNotifyPropsDefaultedToUserNotifyProps});
    }

    function handleSave() {
        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(props.currentUser.notify_props, settings, desktopAndMobileSettingsDifferent);

        props.actions.updateChannelNotifyProps(props.currentUser.id, props.channel.id, channelNotifyProps).then((value) => {
            const {error} = value;
            if (error) {
                setServerError(error.message);
            } else {
                handleHide();
            }
        });
    }

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

    const handleChangeForMessageNotificationSoundSelect = (selectedOption: OnChangeValue<Option, boolean>) => {
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
                inputFieldValue={settings.desktop || ''}
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
                inputFieldValue={!desktopAndMobileSettingsDifferent}
                inputFieldData={utils.sameMobileSettingsDesktopInputFieldData}
                handleChange={handleUseSameMobileSettingsAsDesktopCheckboxChange}
            />
            {desktopAndMobileSettingsDifferent && (
                <>
                    <RadioSettingItem
                        dataTestId='mobile-notify-me-radio-section'
                        title={formatMessage({
                            id: 'channel_notifications.NotifyMeTitle',
                            defaultMessage: 'Notify me about…',
                        })}
                        inputFieldValue={settings.push || ''}
                        inputFieldData={utils.mobileNotificationInputFieldData(props.currentUser.notify_props.push)}
                        handleChange={(e) => handleChange({push: e.target.value})}
                    />
                    {props.collapsedReplyThreads && settings.push === 'mention' &&
                        <CheckboxSettingItem
                            dataTestId='mobile-reply-threads-checkbox-section'
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

    const desktopAndMobileNotificationSectionContent = settings.mark_unread === 'all' ? (
        <>
            <div className='ChannelNotificationModal__divider'/>
            <ModalSection
                title={formatMessage({
                    id: 'channel_notifications.desktopNotificationsTitle',
                    defaultMessage: 'Desktop Notifications',
                })}
                titleSuffix={
                    <ResetToDefaultButton
                        sectionName={SectionName.Desktop}
                        userNotifyProps={props.currentUser.notify_props}
                        userSelectedChannelNotifyProps={settings}
                        onClick={handleResetToDefaultClicked}
                    />
                }
                description={formatMessage({
                    id: 'channel_notifications.desktopNotificationsDesc',
                    defaultMessage: 'Available on Chrome, Edge, Firefox, and the Mattermost Desktop App.',
                })}
                content={desktopNotificationsSectionContent}
            />
            <div className='ChannelNotificationModal__divider'/>
            <ModalSection
                title={formatMessage({
                    id: 'channel_notifications.mobileNotificationsTitle',
                    defaultMessage: 'Mobile Notifications',
                })}
                titleSuffix={
                    <ResetToDefaultButton
                        sectionName={SectionName.Mobile}
                        userNotifyProps={props.currentUser.notify_props}
                        userSelectedChannelNotifyProps={settings}
                        onClick={handleResetToDefaultClicked}
                    />
                }
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

    const footerContent = (
        <footer className='ChannelNotificationModal__footer'>
            {serverError &&
            <span
                role='alert'
                className='ChannelNotificationModal__server-error'
            >
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
    );

    const headerText = (
        <ModalHeader
            id={'channelNotificationModalLabel'}
            title={formatMessage({
                id: 'channel_notifications.preferences',
                defaultMessage: 'Notification Preferences',
            })}
            subtitle={props.channel.display_name}
        />
    );

    return (
        <GenericModal
            id='channelNotificationModal'
            className='a11y__modal ChannelNotificationModal modal--overflow'
            show={show}
            onHide={handleHide}
            onExited={handleExited}
            ariaLabel='channelNotificationModalLabel'
            compassDesign={true}
            footerContent={footerContent}
            modalHeaderText={headerText}
            bodyPadding={false}
            footerDivider={true}
        >

            <main className='ChannelNotificationModal__body'>
                <fieldset aria-labelledby='ChannelNotificationModal-legend'>
                    <ModalSection
                        title={
                            <legend
                                style={{all: 'unset'}}
                                id='ChannelNotificationModal-legend'
                            >
                                {formatMessage({
                                    id: 'channel_notifications.muteAndIgnore',
                                    defaultMessage: 'Mute or ignore',
                                })}
                            </legend>
                        }
                        content={muteOrIgnoreSectionContent}
                    />
                </fieldset>
                {desktopAndMobileNotificationSectionContent}
                {props.collapsedReplyThreads &&
                    <>
                        <div className='ChannelNotificationModal__divider'/>
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
        </GenericModal>
    );
}

function getStateFromNotifyProps(
    currentUserNotifyProps: UserNotifyProps,
    channelMemberNotifyProps?: ChannelMembership['notify_props'],
): Required<Omit<ChannelMembership['notify_props'], 'email'>> {
    return {
        mark_unread: channelMemberNotifyProps?.mark_unread ?? NotificationLevels.ALL,
        ignore_channel_mentions: getInitialValuesOfIgnoreChannelMentions(
            channelMemberNotifyProps?.mark_unread,
            channelMemberNotifyProps?.ignore_channel_mentions,
            currentUserNotifyProps?.channel,
        ),
        desktop: getInitialValuesOfChannelNotifyProps<ChannelMembership['notify_props']['desktop']>(
            NotificationLevels.ALL,
            channelMemberNotifyProps?.desktop,
            currentUserNotifyProps?.desktop,
        ),
        desktop_threads: getInitialValuesOfChannelNotifyProps<ChannelMembership['notify_props']['desktop_threads']>(
            NotificationLevels.ALL,
            channelMemberNotifyProps?.desktop_threads,
            currentUserNotifyProps?.desktop_threads,
        ),
        desktop_sound: getInitialValuesOfChannelNotifyProps<ChannelMembership['notify_props']['desktop_sound']>(
            DesktopSound.ON,
            channelMemberNotifyProps?.desktop_sound,
            convertDesktopSoundNotifyPropFromUserToDesktop(currentUserNotifyProps?.desktop_sound),
        ),
        desktop_notification_sound: getInitialValuesOfChannelNotifyProps<ChannelMembership['notify_props']['desktop_notification_sound']>(
            DesktopNotificationSounds.BING,
            channelMemberNotifyProps?.desktop_notification_sound,
            currentUserNotifyProps?.desktop_notification_sound,
        ),
        push: getInitialValuesOfChannelNotifyProps<ChannelMembership['notify_props']['push']>(
            NotificationLevels.ALL,
            channelMemberNotifyProps?.push,
            currentUserNotifyProps?.push,
        ),
        push_threads: getInitialValuesOfChannelNotifyProps<ChannelMembership['notify_props']['push_threads']>(
            NotificationLevels.ALL,
            channelMemberNotifyProps?.push_threads,
            currentUserNotifyProps?.push_threads,
        ),
        channel_auto_follow_threads: channelMemberNotifyProps?.channel_auto_follow_threads ?? 'off',
    };
}

export function getInitialValuesOfChannelNotifyProps<KeyInNotifyProps>(
    defaultValue: NonNullable<KeyInNotifyProps>,
    channelMemberNotifyProp: KeyInNotifyProps | undefined = undefined,
    userNotifyProp: KeyInNotifyProps | undefined = undefined,
) {
    let value = defaultValue;

    // Check if channel_member's notify_prop is defined for the selected notify_prop
    if (channelMemberNotifyProp) {
        // If channel_member's notify_prop is default and user's notify_prop is defined, we should use user's notify_prop
        if (channelMemberNotifyProp === NotificationLevels.DEFAULT && userNotifyProp) {
            value = userNotifyProp;
        } else {
            // Otherwise, we should use channel_member's notify_prop as is
            value = channelMemberNotifyProp;
        }
    } else if (userNotifyProp) {
        // If channel_member's notify_prop is not defined and user's notify_prop is defined, we should use user's notify_prop as is
        value = userNotifyProp;
    }

    return value;
}

export function getInitialValuesOfIgnoreChannelMentions(
    markUnread: ChannelMembership['notify_props']['mark_unread'],
    ignoreChannelMentions: ChannelMembership['notify_props']['ignore_channel_mentions'],
    userNotifyPropForChannel: UserNotifyProps['channel'],
): NonNullable<ChannelMembership['notify_props']['ignore_channel_mentions']> {
    let ignoreChannelMentionsDefault: ChannelNotifyProps['ignore_channel_mentions'] = IgnoreChannelMentions.OFF;
    if (
        markUnread === NotificationLevels.MENTION ||
        (userNotifyPropForChannel && userNotifyPropForChannel === 'false')
    ) {
        ignoreChannelMentionsDefault = IgnoreChannelMentions.ON;
    }

    if (ignoreChannelMentions) {
        if (ignoreChannelMentions === IgnoreChannelMentions.DEFAULT) {
            return ignoreChannelMentionsDefault;
        }
        return ignoreChannelMentions;
    }

    return ignoreChannelMentionsDefault;
}

export function createChannelNotifyPropsFromSelectedSettings(
    userNotifyProps: UserNotifyProps,
    savedChannelNotifyProps: ChannelMembership['notify_props'],
    desktopAndMobileSettingsDifferent: boolean,
) {
    const channelNotifyProps: ChannelMembership['notify_props'] = {
        mark_unread: savedChannelNotifyProps.mark_unread,
        ignore_channel_mentions: savedChannelNotifyProps.ignore_channel_mentions,
        channel_auto_follow_threads: savedChannelNotifyProps.channel_auto_follow_threads,
    };

    if (savedChannelNotifyProps.desktop === userNotifyProps.desktop) {
        channelNotifyProps.desktop = NotificationLevels.DEFAULT;
    } else {
        channelNotifyProps.desktop = savedChannelNotifyProps.desktop;
    }

    // Check if USER's desktop_thread setting are defined
    if (userNotifyProps?.desktop_threads?.length) {
        // If USER's desktop_thread setting is same as CHANNEL's new desktop_threads setting, we should set it to default
        if (userNotifyProps.desktop_threads === savedChannelNotifyProps.desktop_threads) {
            channelNotifyProps.desktop_threads = NotificationLevels.DEFAULT;
        } else {
            // Otherwise, we should use the CHANNEL's new desktop_threads setting as is
            channelNotifyProps.desktop_threads = savedChannelNotifyProps.desktop_threads;
        }
    } else if (savedChannelNotifyProps.desktop_threads === NotificationLevels.MENTION || savedChannelNotifyProps.desktop_threads === NotificationLevels.DEFAULT) {
        // If USER's desktop_thread setting is not defined and CHANNEL's new desktop_threads setting is MENTION or DEFAULT, then save it as default
        channelNotifyProps.desktop_threads = NotificationLevels.DEFAULT;
    } else {
        // Otherwise, we should use the CHANNEL's new desktop_threads setting as is
        channelNotifyProps.desktop_threads = savedChannelNotifyProps.desktop_threads;
    }

    if (convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps?.desktop_sound) === savedChannelNotifyProps.desktop_sound) {
        channelNotifyProps.desktop_sound = DesktopSound.DEFAULT;
    } else {
        channelNotifyProps.desktop_sound = savedChannelNotifyProps.desktop_sound;
    }

    // Check if USER's desktop_notification_sound setting is defined
    if (userNotifyProps?.desktop_notification_sound?.length) {
        // If USER's desktop_notification_sound setting is same as CHANNEL's new desktop_notification_sound setting, we should set it to default
        if (userNotifyProps.desktop_notification_sound === savedChannelNotifyProps.desktop_notification_sound) {
            channelNotifyProps.desktop_notification_sound = DesktopNotificationSounds.DEFAULT;
        } else {
            // Otherwise, we should use the CHANNEL's new desktop_notification_sound setting as is
            channelNotifyProps.desktop_notification_sound = savedChannelNotifyProps.desktop_notification_sound;
        }
    } else if (
        savedChannelNotifyProps.desktop_notification_sound === DesktopNotificationSounds.BING ||
        savedChannelNotifyProps.desktop_notification_sound === DesktopNotificationSounds.DEFAULT
    ) {
        channelNotifyProps.desktop_notification_sound = DesktopNotificationSounds.DEFAULT;
    } else {
        // Otherwise, we should use the CHANNEL's new desktop_notification_sound setting as is
        channelNotifyProps.desktop_notification_sound = savedChannelNotifyProps.desktop_notification_sound;
    }

    if (savedChannelNotifyProps.push === userNotifyProps.push) {
        channelNotifyProps.push = NotificationLevels.DEFAULT;
    } else {
        channelNotifyProps.push = savedChannelNotifyProps.push;
    }

    // Check if USER's push_threads setting are defined
    if (userNotifyProps?.push_threads?.length) {
        // If USER's push_threads setting is same as CHANNEL's new push_threads setting, we should set it to default
        if (userNotifyProps.push_threads === savedChannelNotifyProps.push_threads) {
            channelNotifyProps.push_threads = NotificationLevels.DEFAULT;
        } else {
            // Otherwise, we should use the CHANNEL's new push_threads setting as is
            channelNotifyProps.push_threads = savedChannelNotifyProps.push_threads;
        }
    } else if (savedChannelNotifyProps.push_threads === NotificationLevels.MENTION || savedChannelNotifyProps.push_threads === NotificationLevels.DEFAULT) {
        // If USER's push_threads setting is not defined and CHANNEL's new push_threads setting is MENTION or DEFAULT, then save it as default
        channelNotifyProps.push_threads = NotificationLevels.DEFAULT;
    } else {
        // Otherwise, we should use the CHANNEL's new push_threads setting as is
        channelNotifyProps.push_threads = savedChannelNotifyProps.push_threads;
    }

    // If desktop and mobile settings are checked to be same, then same settings should be applied to push and push_threads
    // as that of desktop and desktop_threads
    if (desktopAndMobileSettingsDifferent === false) {
        // If desktop is set to default, it means it is synced to the user's notification settings.
        // Since we checked the box to use the same settings for mobile, we need to set channel's mobile to match channel's desktop.
        // Setting mobile to default would sync it to the user's notification settings, which we want to avoid.
        if (channelNotifyProps.desktop === NotificationLevels.DEFAULT) {
            channelNotifyProps.push = userNotifyProps.desktop;
        } else {
            // Otherwise, we should use the CHANNEL's desktop setting as is to match mobile settings
            channelNotifyProps.push = channelNotifyProps.desktop;
        }

        if (channelNotifyProps.desktop_threads === NotificationLevels.DEFAULT) {
            channelNotifyProps.push_threads = userNotifyProps.desktop_threads;
        } else {
            channelNotifyProps.push_threads = channelNotifyProps.desktop_threads;
        }
    }

    return channelNotifyProps;
}

/**
 * Check's if channel's notification settings for desktop and mobile are different
 */
export function areDesktopAndMobileSettingsDifferent(
    isCollapsedThreadsEnabled: boolean,
    desktop: UserNotifyProps['desktop'],
    desktopThreads: UserNotifyProps['desktop_threads'],
    push?: UserNotifyProps['push'],
    pushThreads?: UserNotifyProps['push_threads'],
): boolean {
    if (push === NotificationLevels.DEFAULT || push === desktop) {
        return isCollapsedThreadsEnabled && desktopThreads !== pushThreads;
    }
    return true;
}
