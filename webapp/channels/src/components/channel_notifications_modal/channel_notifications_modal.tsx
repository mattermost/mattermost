// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import deepEqual from 'fast-deep-equal';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {isChannelMuted} from 'mattermost-redux/utils/channel_utils';

import {ChannelAutoFollowThreads, IgnoreChannelMentions, NotificationLevels, NotificationSections} from 'utils/constants';

import NotificationSection from 'components/channel_notifications_modal/components/notification_section.jsx';

import {Channel, ChannelNotifyProps} from '@mattermost/types/channels';
import {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import type {PropsFromRedux} from './index';

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

export type ChannelMemberNotifyProps = Partial<ChannelNotifyProps> & Pick<UserNotifyProps, 'desktop_threads' | 'push_threads'>

type State = {
    show: boolean;
    activeSection: string;
    serverError: string | null;
    desktopNotifyLevel: ChannelNotifyProps['desktop'];
    desktopThreadsNotifyLevel: UserNotifyProps['desktop_threads'];
    markUnreadNotifyLevel: ChannelNotifyProps['mark_unread'];
    pushNotifyLevel: ChannelNotifyProps['push'];
    pushThreadsNotifyLevel: UserNotifyProps['push_threads'];
    ignoreChannelMentions: ChannelNotifyProps['ignore_channel_mentions'];
    channelAutoFollowThreads: ChannelNotifyProps['channel_auto_follow_threads'];
};

export default class ChannelNotificationsModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        const channelNotifyProps = props.channelMember && props.channelMember.notify_props;

        this.state = {
            show: true,
            activeSection: NotificationSections.NONE,
            serverError: null,
            ...this.getStateFromNotifyProps(props.currentUser.notify_props, channelNotifyProps),
        };
    }

    componentDidUpdate(prevProps: Props) {
        const prevChannelNotifyProps = prevProps.channelMember && prevProps.channelMember.notify_props;
        const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props;

        if (!deepEqual(channelNotifyProps, prevChannelNotifyProps)) {
            this.resetStateFromNotifyProps(this.props.currentUser.notify_props, channelNotifyProps);
        }
    }

    resetStateFromNotifyProps(currentUserNotifyProps: UserNotifyProps, channelMemberNotifyProps?: Partial<ChannelNotifyProps>) {
        this.setState(this.getStateFromNotifyProps(currentUserNotifyProps, channelMemberNotifyProps));
    }

    getStateFromNotifyProps(currentUserNotifyProps: UserNotifyProps, channelMemberNotifyProps?: ChannelMemberNotifyProps) {
        let ignoreChannelMentionsDefault: ChannelNotifyProps['ignore_channel_mentions'] = IgnoreChannelMentions.OFF;

        if (channelMemberNotifyProps?.mark_unread === NotificationLevels.MENTION || (currentUserNotifyProps.channel && currentUserNotifyProps.channel === 'false')) {
            ignoreChannelMentionsDefault = IgnoreChannelMentions.ON;
        }

        let ignoreChannelMentions = channelMemberNotifyProps?.ignore_channel_mentions;
        if (!ignoreChannelMentions || ignoreChannelMentions === IgnoreChannelMentions.DEFAULT) {
            ignoreChannelMentions = ignoreChannelMentionsDefault;
        }

        return {
            desktopNotifyLevel: channelMemberNotifyProps?.desktop || NotificationLevels.DEFAULT,
            desktopThreadsNotifyLevel: channelMemberNotifyProps?.desktop_threads || NotificationLevels.ALL,
            markUnreadNotifyLevel: channelMemberNotifyProps?.mark_unread || NotificationLevels.ALL,
            pushNotifyLevel: channelMemberNotifyProps?.push || NotificationLevels.DEFAULT,
            pushThreadsNotifyLevel: channelMemberNotifyProps?.push_threads || NotificationLevels.ALL,
            ignoreChannelMentions,
            channelAutoFollowThreads: channelMemberNotifyProps?.channel_auto_follow_threads || ChannelAutoFollowThreads.OFF,
        };
    }

    handleHide = () => this.setState({show: false});

    handleExit = () => {
        this.updateSection(NotificationSections.NONE);
        this.props.onExited();
    };

    updateSection = (section = NotificationSections.NONE) => {
        this.setState({activeSection: section});

        if (section === NotificationSections.NONE) {
            const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props;
            this.resetStateFromNotifyProps(this.props.currentUser.notify_props, channelNotifyProps);
        }
    };

    handleUpdateChannelNotifyProps = async (props: Partial<ChannelNotifyProps>) => {
        const {
            actions,
            channel,
            currentUser,
        } = this.props;

        const {error} = await actions.updateChannelNotifyProps(currentUser.id, channel.id, props);
        if (error) {
            this.setState({serverError: error.message});
        } else {
            this.updateSection(NotificationSections.NONE);
        }
    };

    handleSubmitDesktopNotifyLevel = () => {
        const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props as ChannelMemberNotifyProps;
        const {desktopNotifyLevel, desktopThreadsNotifyLevel} = this.state;

        if (
            channelNotifyProps?.desktop === desktopNotifyLevel &&
            channelNotifyProps?.desktop_threads === desktopThreadsNotifyLevel
        ) {
            this.updateSection(NotificationSections.NONE);
            return;
        }

        const props = {desktop: desktopNotifyLevel, desktop_threads: desktopThreadsNotifyLevel};

        this.handleUpdateChannelNotifyProps(props);
    };

    handleUpdateDesktopNotifyLevel = (desktopNotifyLevel: ChannelNotifyProps['desktop']) => this.setState({desktopNotifyLevel});

    handleUpdateDesktopThreadsNotifyLevel = (desktopThreadsNotifyLevel: UserNotifyProps['desktop_threads']) => this.setState({desktopThreadsNotifyLevel});

    handleSubmitMarkUnreadLevel = () => {
        const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props;
        const {markUnreadNotifyLevel} = this.state;

        if (channelNotifyProps?.mark_unread === markUnreadNotifyLevel) {
            this.updateSection(NotificationSections.NONE);
            return;
        }

        const props = {mark_unread: markUnreadNotifyLevel};
        this.handleUpdateChannelNotifyProps(props);
    };

    handleUpdateMarkUnreadLevel = (markUnreadNotifyLevel: ChannelNotifyProps['mark_unread']) => this.setState({markUnreadNotifyLevel});

    handleSubmitPushNotificationLevel = () => {
        const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props as ChannelMemberNotifyProps;
        const {pushNotifyLevel, pushThreadsNotifyLevel} = this.state;

        if (
            channelNotifyProps?.push === pushNotifyLevel &&
            channelNotifyProps?.push_threads === pushThreadsNotifyLevel
        ) {
            this.updateSection(NotificationSections.NONE);
            return;
        }

        const props = {push: pushNotifyLevel, push_threads: pushThreadsNotifyLevel};
        this.handleUpdateChannelNotifyProps(props);
    };

    handleUpdatePushNotificationLevel = (pushNotifyLevel: ChannelNotifyProps['push']) => this.setState({pushNotifyLevel});
    handleUpdatePushThreadsNotificationLevel = (pushThreadsNotifyLevel: UserNotifyProps['push_threads']) => this.setState({pushThreadsNotifyLevel});
    handleUpdateIgnoreChannelMentions = (ignoreChannelMentions: ChannelNotifyProps['ignore_channel_mentions']) => this.setState({ignoreChannelMentions});

    handleSubmitIgnoreChannelMentions = () => {
        const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props;
        const {ignoreChannelMentions} = this.state;

        if (channelNotifyProps?.ignore_channel_mentions === ignoreChannelMentions) {
            this.updateSection(NotificationSections.NONE);
            return;
        }

        const props = {ignore_channel_mentions: ignoreChannelMentions};
        this.handleUpdateChannelNotifyProps(props);
    };

    handleUpdateChannelAutoFollowThreads = (channelAutoFollowThreads: ChannelNotifyProps['channel_auto_follow_threads']) => this.setState({channelAutoFollowThreads});

    handleSubmitChannelAutoFollowThreads = () => {
        const channelNotifyProps = this.props.channelMember && this.props.channelMember.notify_props;
        const {channelAutoFollowThreads} = this.state;

        if (channelNotifyProps?.channel_auto_follow_threads === channelAutoFollowThreads) {
            this.updateSection(NotificationSections.NONE);
            return;
        }

        const props = {channel_auto_follow_threads: channelAutoFollowThreads};
        this.handleUpdateChannelNotifyProps(props);
    };

    render() {
        const {
            activeSection,
            desktopNotifyLevel,
            desktopThreadsNotifyLevel,
            markUnreadNotifyLevel,
            pushNotifyLevel,
            pushThreadsNotifyLevel,
            ignoreChannelMentions,
            channelAutoFollowThreads,
            serverError,
        } = this.state;

        const {
            channel,
            channelMember,
            currentUser,
            sendPushNotifications,
        } = this.props;

        let serverErrorTag = null;
        if (serverError) {
            serverErrorTag = <div className='form-group has-error'><label className='control-label'>{serverError}</label></div>;
        }

        return (
            <Modal
                dialogClassName='a11y__modal settings-modal settings-modal--tabless'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                role='dialog'
                aria-labelledby='channelNotificationModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='channelNotificationModalLabel'
                    >
                        <FormattedMessage
                            id='channel_notifications.preferences'
                            defaultMessage='Notification Preferences for '
                        />
                        <span className='name'>{channel.display_name}</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='settings-table'>
                        <div className='settings-content'>
                            <div className='user-settings'>
                                <br/>
                                <div className='divider-dark first'/>
                                <NotificationSection
                                    section={NotificationSections.MARK_UNREAD}
                                    expand={activeSection === NotificationSections.MARK_UNREAD}
                                    memberNotificationLevel={markUnreadNotifyLevel}
                                    onChange={this.handleUpdateMarkUnreadLevel}
                                    onSubmit={this.handleSubmitMarkUnreadLevel}
                                    onUpdateSection={this.updateSection}
                                    serverError={serverError}
                                />
                                <div className='divider-light'/>
                                <NotificationSection
                                    section={NotificationSections.IGNORE_CHANNEL_MENTIONS}
                                    expand={activeSection === NotificationSections.IGNORE_CHANNEL_MENTIONS}
                                    memberNotificationLevel={markUnreadNotifyLevel}
                                    ignoreChannelMentions={ignoreChannelMentions}
                                    onChange={this.handleUpdateIgnoreChannelMentions}
                                    onSubmit={this.handleSubmitIgnoreChannelMentions}
                                    onUpdateSection={this.updateSection}
                                    serverError={serverError}
                                />
                                {!isChannelMuted(channelMember) &&
                                <div>
                                    <div className='divider-light'/>
                                    <NotificationSection
                                        section={NotificationSections.DESKTOP}
                                        expand={activeSection === NotificationSections.DESKTOP}
                                        memberNotificationLevel={desktopNotifyLevel}
                                        memberThreadsNotificationLevel={desktopThreadsNotifyLevel}
                                        globalNotificationLevel={currentUser.notify_props ? currentUser.notify_props.desktop : NotificationLevels.ALL}
                                        onChange={this.handleUpdateDesktopNotifyLevel}
                                        onChangeThreads={this.handleUpdateDesktopThreadsNotifyLevel}
                                        onSubmit={this.handleSubmitDesktopNotifyLevel}
                                        onUpdateSection={this.updateSection}
                                        serverError={serverError}
                                    />
                                    <div className='divider-light'/>
                                    {sendPushNotifications &&
                                    <NotificationSection
                                        section={NotificationSections.PUSH}
                                        expand={activeSection === NotificationSections.PUSH}
                                        memberNotificationLevel={pushNotifyLevel}
                                        memberThreadsNotificationLevel={pushThreadsNotifyLevel}
                                        globalNotificationLevel={currentUser.notify_props ? currentUser.notify_props.push : NotificationLevels.ALL}
                                        onChange={this.handleUpdatePushNotificationLevel}
                                        onChangeThreads={this.handleUpdatePushThreadsNotificationLevel}
                                        onSubmit={this.handleSubmitPushNotificationLevel}
                                        onUpdateSection={this.updateSection}
                                        serverError={serverError}
                                    />
                                    }
                                </div>
                                }
                                <div className='divider-light'/>
                                <NotificationSection
                                    section={NotificationSections.CHANNEL_AUTO_FOLLOW_THREADS}
                                    expand={activeSection === NotificationSections.CHANNEL_AUTO_FOLLOW_THREADS}
                                    memberNotificationLevel={markUnreadNotifyLevel}
                                    ignoreChannelMentions={ignoreChannelMentions}
                                    channelAutoFollowThreads={channelAutoFollowThreads}
                                    onChange={this.handleUpdateChannelAutoFollowThreads}
                                    onSubmit={this.handleSubmitChannelAutoFollowThreads}
                                    onUpdateSection={this.updateSection}
                                    serverError={serverError}
                                />
                                <div className='divider-dark'/>
                            </div>
                        </div>
                    </div>
                    {serverErrorTag}
                </Modal.Body>
            </Modal>
        );
    }
}
