// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {BellOffOutlineIcon, RefreshIcon} from '@mattermost/compass-icons/components';
import type {Channel, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import AlertBanner from 'components/alert_banner';

import {IgnoreChannelMentions, NotificationLevels} from 'utils/constants';

import CheckboxItemCreator from './checkbox-item-creator';
import ModalHeader from './modal_header';
import RadioItemCreator from './radio-item-creator';
import SectionCreator from './section_creator';
import type {
    ChannelMemberNotifyProps} from './utils';
import {
    desktopNotificationInputFieldData,
    DesktopNotificationsSectionDesc,
    DesktopNotificationsSectionTitle,
    IgnoreMentionsDesc,
    IgnoreMentionsInputFieldData,
    mobileNotificationInputFieldData,
    MobileNotificationsSectionDesc,
    MobileNotificationsSectionTitle,
    MuteAndIgnoreSectionTitle,
    MuteChannelDesc,
    MuteChannelInputFieldData,
    NotifyMeTitle,
    DesktopReplyThreadsInputFieldData,
    ThreadsReplyTitle,
    MobileReplyThreadsInputFieldData,
    AutoFollowThreadsTitle,
    AutoFollowThreadsDesc,
    AutoFollowThreadsInputFieldData,
    sameMobileSettingsDesktopInputFieldData,
} from './utils';

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
    const isSameAsDesktop = channelMemberNotifyProps?.desktop === channelMemberNotifyProps?.push || currentUserNotifyProps.push === currentUserNotifyProps.desktop;
    const isSameAsDesktopThreads = channelMemberNotifyProps?.desktop_threads === channelMemberNotifyProps?.push_threads || currentUserNotifyProps.push_threads === currentUserNotifyProps.desktop_threads;
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

    return {
        desktop,
        desktop_threads: channelMemberNotifyProps?.desktop_threads || NotificationLevels.ALL,
        mark_unread: channelMemberNotifyProps?.mark_unread || NotificationLevels.ALL,
        push,
        push_threads: channelMemberNotifyProps?.push_threads || NotificationLevels.ALL,
        ignore_channel_mentions: ignoreChannelMentions,
        channel_auto_follow_threads: channelMemberNotifyProps?.channel_auto_follow_threads || 'false',
    };
}

type SettingsType = {
    desktop: ChannelNotifyProps['desktop'];
    channel_auto_follow_threads: 'true' | 'false';
    desktop_threads: ChannelNotifyProps['desktop_threads'];
    mark_unread: ChannelNotifyProps['mark_unread'];
    push: ChannelNotifyProps['push'];
    push_threads: ChannelNotifyProps['push_threads'];
    ignore_channel_mentions: ChannelNotifyProps['ignore_channel_mentions'];
};

export default function ChannelNotificationsModal(props: Props) {
    const {formatMessage} = useIntl();
    const [show, setShow] = useState(true);
    const [serverError, setServerError] = useState('');
    const [channelNotifyProps] = useState(props.channelMember && props.channelMember.notify_props);
    const [mobileSettingsSameAsDesktop, setMobileSettingsSameAsDesktop] = useState<boolean>(getUseSameDesktopSetting(props.currentUser.notify_props, channelNotifyProps));

    const [settings, setSettings] = useState<SettingsType>(getStateFromNotifyProps(props.currentUser.notify_props, channelNotifyProps));

    function handleHide() {
        setShow(false);
    }

    function handleExit() {
        props.onExited();
    }

    const resetToDefault = useCallback((settingName: string) => {
        const defaultSettings = props.currentUser.notify_props;
        if (settingName === 'desktop') {
            setSettings({...settings, desktop: defaultSettings.desktop, desktop_threads: defaultSettings.desktop_threads || settings.desktop_threads});
        }
        if (settingName === 'push') {
            setSettings({...settings, push: defaultSettings.desktop, push_threads: defaultSettings.push_threads || settings.push_threads});
        }
    }, [settings, props.currentUser]);

    const handleChange = useCallback((values: Record<string, string>) => {
        setSettings({...settings, ...values});
    }, [settings]);

    const handleMobileSettingsChange = useCallback(() => {
        setMobileSettingsSameAsDesktop(!mobileSettingsSameAsDesktop);
        setSettings({...settings, push: settings.desktop, push_threads: settings.desktop_threads});
    }, [mobileSettingsSameAsDesktop, settings]);

    const MuteIgnoreSectionContent = (
        <>
            <CheckboxItemCreator
                description={MuteChannelDesc}
                inputFieldValue={settings.mark_unread === 'mention'}
                inputFieldData={MuteChannelInputFieldData}
                handleChange={(e) => handleChange({mark_unread: e ? 'mention' : 'all'})}
            />
            <CheckboxItemCreator
                description={IgnoreMentionsDesc}
                inputFieldValue={settings.ignore_channel_mentions === 'on'}
                inputFieldData={IgnoreMentionsInputFieldData}
                handleChange={(e) => handleChange({ignore_channel_mentions: e ? 'on' : 'off'})}
            />
        </>
    );

    const DesktopNotificationsSectionContent = (
        <>
            <RadioItemCreator
                title={NotifyMeTitle}
                inputFieldValue={settings.desktop}
                inputFieldData={desktopNotificationInputFieldData(props.currentUser.notify_props.desktop)}
                handleChange={(e) => handleChange({desktop: e.target.value})}
            />
            {props.collapsedReplyThreads && settings.desktop === 'mention' &&
                <CheckboxItemCreator
                    title={ThreadsReplyTitle}
                    inputFieldValue={settings.desktop_threads === 'all'}
                    inputFieldData={DesktopReplyThreadsInputFieldData}
                    handleChange={(e) => handleChange({desktop_threads: e ? 'all' : 'mention'})}
                />}
        </>
    );

    const MobileNotificationsSectionContent = (
        <>
            <CheckboxItemCreator
                inputFieldValue={mobileSettingsSameAsDesktop}
                inputFieldData={sameMobileSettingsDesktopInputFieldData}
                handleChange={() => handleMobileSettingsChange()}
            />
            {!mobileSettingsSameAsDesktop && (
                <>
                    <RadioItemCreator
                        title={NotifyMeTitle}
                        inputFieldValue={settings.push}
                        inputFieldData={mobileNotificationInputFieldData(props.currentUser.notify_props.push)}
                        handleChange={(e) => handleChange({push: e.target.value})}
                    />
                    {props.collapsedReplyThreads && settings.push === 'mention' &&
                    <CheckboxItemCreator
                        title={ThreadsReplyTitle}
                        inputFieldValue={settings.push_threads === 'all'}
                        inputFieldData={MobileReplyThreadsInputFieldData}
                        handleChange={(e) => handleChange({push_threads: e ? 'all' : 'mention'})}
                    />}
                </>
            )}
        </>
    );

    const AutoFollowThreadsSectionContent = (
        <>
            <CheckboxItemCreator
                inputFieldValue={settings.channel_auto_follow_threads === 'true'}
                inputFieldData={AutoFollowThreadsInputFieldData}
                handleChange={(e) => handleChange({channel_auto_follow_threads: e ? 'true' : 'false'})}
            />
        </>
    );

    async function handleSave() {
        const userSettings: Partial<SettingsType> = {...settings};
        if (!props.collapsedReplyThreads) {
            delete userSettings.push_threads;
            delete userSettings.desktop_threads;
            delete userSettings.channel_auto_follow_threads;
        }
        await props.actions.updateChannelNotifyProps(props.currentUser.id, props.channel.id, userSettings).then((value) => {
            const {error} = value;
            if (error) {
                setServerError(error.message);
            } else {
                handleHide();
            }
        });
    }

    const resetToDefaultBtn = useCallback((settingName: string) => {
        const defaultSettings = props.currentUser.notify_props;

        const isDesktopSameAsDefault = (defaultSettings.desktop === settings.desktop && defaultSettings.desktop_threads === settings.desktop_threads);
        const isPushSameAsDefault = (defaultSettings.push === settings.push && defaultSettings.push_threads === settings.push_threads);
        if ((settingName === 'desktop' && isDesktopSameAsDefault) || (settingName === 'push' && isPushSameAsDefault)) {
            return <></>;
        }
        return (
            <button
                className='channel-notifications-settings-modal__reset-btn'
                onClick={() => resetToDefault(settingName)}
            >
                <RefreshIcon
                    size={14}
                    color={'currentColor'}
                />
                {formatMessage({
                    id: 'channel_notifications.resetToDefault',
                    defaultMessage: 'Reset to default',
                })}
            </button>
        );
    }, [props.currentUser, settings]);

    const settingsAndAlertBanner = settings.mark_unread === 'all' ? (
        <>
            <div className='channel-notifications-settings-modal__divider'/>
            <SectionCreator
                title={DesktopNotificationsSectionTitle}
                description={DesktopNotificationsSectionDesc}
                content={DesktopNotificationsSectionContent}
                titleSuffix={resetToDefaultBtn('desktop')}
            />
            <div className='channel-notifications-settings-modal__divider'/>
            <SectionCreator
                title={MobileNotificationsSectionTitle}
                description={MobileNotificationsSectionDesc}
                content={MobileNotificationsSectionContent}
                titleSuffix={resetToDefaultBtn('push')}
            />
        </>
    ) : (
        <AlertBanner
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
            onExited={handleExit}
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
                <SectionCreator
                    title={MuteAndIgnoreSectionTitle}
                    content={MuteIgnoreSectionContent}
                />
                {settingsAndAlertBanner}
                {props.collapsedReplyThreads &&
                    <>
                        <div className='channel-notifications-settings-modal__divider'/>
                        <SectionCreator
                            title={AutoFollowThreadsTitle}
                            description={AutoFollowThreadsDesc}
                            content={AutoFollowThreadsSectionContent}
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
                    onClick={handleHide}
                    className='channel-notifications-settings-modal__cancel-btn'
                >
                    <FormattedMessage
                        id='generic_btn.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    className={'channel-notifications-settings-modal__save-btn'}
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
