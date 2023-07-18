// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React, {ChangeEvent, RefObject} from 'react';
import {FormattedMessage, injectIntl, WrappedComponentProps} from 'react-intl';
import CreatableReactSelect from 'react-select/creatable';
import {Styles as ReactSelectStyles, ValueType} from 'react-select';

import {UserNotifyProps, UserProfile} from '@mattermost/types/users';
import {ServerError} from '@mattermost/types/errors';

import {ActionResult} from 'mattermost-redux/types/actions';

import Constants, {NotificationLevels} from 'utils/constants';
import {stopTryNotificationRing} from 'utils/notification_sounds';
import {a11yFocus} from 'utils/utils';
import {t} from 'utils/i18n';

import SettingItem from 'components/setting_item';
import LocalizedIcon from 'components/localized_icon';
import SettingItemMax from 'components/setting_item_max';

import DesktopNotificationSettings from './desktop_notification_setting/desktop_notification_settings';
import EmailNotificationSetting from './email_notification_setting';
import ManageAutoResponder from './manage_auto_responder/manage_auto_responder';

import type {PropsFromRedux} from './index';
import './user_settings_notifications.scss';

type MultiInputValue = {
    label: string;
    value: string;
}

type OwnProps = {
    user: UserProfile;
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
}

type Props = PropsFromRedux & OwnProps & WrappedComponentProps;

type State = {
    enableEmail: UserNotifyProps['email'];
    desktopActivity: UserNotifyProps['desktop'];
    desktopThreads: UserNotifyProps['desktop_threads'];
    pushThreads: UserNotifyProps['push_threads'];
    emailThreads: UserNotifyProps['email_threads'];
    pushActivity: UserNotifyProps['push'];
    pushStatus: UserNotifyProps['push_status'];
    desktopSound: UserNotifyProps['desktop_sound'];
    callsDesktopSound: UserNotifyProps['calls_desktop_sound'];
    desktopNotificationSound: UserNotifyProps['desktop_notification_sound'];
    callsNotificationSound: UserNotifyProps['calls_notification_sound'];
    usernameKey: boolean;
    isCustomKeysWithNotificationInputChecked: boolean;
    customKeysWithNotification: MultiInputValue[];
    customKeysWithHighlight: MultiInputValue[];
    firstNameKey: boolean;
    channelKey: boolean;
    autoResponderActive: boolean;
    autoResponderMessage: UserNotifyProps['auto_responder_message'];
    notifyCommentsLevel: UserNotifyProps['comments'];
    isSaving: boolean;
    serverError: string;
};

function getNotificationsStateFromProps(props: Props): State {
    let desktop: UserNotifyProps['desktop'] = NotificationLevels.MENTION;
    let desktopThreads: UserNotifyProps['desktop_threads'] = NotificationLevels.ALL;
    let pushThreads: UserNotifyProps['push_threads'] = NotificationLevels.ALL;
    let emailThreads: UserNotifyProps['email_threads'] = NotificationLevels.ALL;
    let sound: UserNotifyProps['desktop_sound'] = 'true';
    let callsSound: UserNotifyProps['calls_desktop_sound'] = 'true';
    let desktopNotificationSound: UserNotifyProps['desktop_notification_sound'] = 'Bing';
    let callsNotificationSound: UserNotifyProps['calls_notification_sound'] = 'Calm';
    let comments: UserNotifyProps['comments'] = 'never';
    let enableEmail: UserNotifyProps['email'] = 'true';
    let pushActivity: UserNotifyProps['push'] = NotificationLevels.MENTION;
    let pushStatus: UserNotifyProps['push_status'] = Constants.UserStatuses.AWAY;
    let autoResponderActive = false;
    let autoResponderMessage: UserNotifyProps['auto_responder_message'] = props.intl.formatMessage({
        id: 'user.settings.notifications.autoResponderDefault',
        defaultMessage: 'Hello, I am out of office and unable to respond to messages.',
    });

    if (props.user.notify_props) {
        if (props.user.notify_props.desktop) {
            desktop = props.user.notify_props.desktop;
        }
        if (props.user.notify_props.desktop_threads) {
            desktopThreads = props.user.notify_props.desktop_threads;
        }
        if (props.user.notify_props.push_threads) {
            pushThreads = props.user.notify_props.push_threads;
        }
        if (props.user.notify_props.email_threads) {
            emailThreads = props.user.notify_props.email_threads;
        }
        if (props.user.notify_props.desktop_sound) {
            sound = props.user.notify_props.desktop_sound;
        }
        if (props.user.notify_props.calls_desktop_sound) {
            callsSound = props.user.notify_props.calls_desktop_sound;
        }
        if (props.user.notify_props.desktop_notification_sound) {
            desktopNotificationSound = props.user.notify_props.desktop_notification_sound;
        }
        if (props.user.notify_props.calls_notification_sound) {
            callsNotificationSound = props.user.notify_props.calls_notification_sound;
        }
        if (props.user.notify_props.comments) {
            comments = props.user.notify_props.comments;
        }
        if (props.user.notify_props.email) {
            enableEmail = props.user.notify_props.email;
        }
        if (props.user.notify_props.push) {
            pushActivity = props.user.notify_props.push;
        }
        if (props.user.notify_props.push_status) {
            pushStatus = props.user.notify_props.push_status;
        }

        if (props.user.notify_props.auto_responder_active) {
            autoResponderActive = props.user.notify_props.auto_responder_active === 'true';
        }

        if (props.user.notify_props.auto_responder_message) {
            autoResponderMessage = props.user.notify_props.auto_responder_message;
        }
    }

    let usernameKey = false;
    let firstNameKey = false;
    let channelKey = false;
    let isCustomKeysWithNotificationInputChecked = false;
    const customKeysWithNotification: MultiInputValue[] = [];
    const customKeysWithHighlight: MultiInputValue[] = [];

    if (props.user.notify_props) {
        if (props.user.notify_props.mention_keys) {
            const mentionKeys = props.user.notify_props.mention_keys.split(',').filter((key) => key.length > 0);
            mentionKeys.forEach((mentionKey) => {
                // Remove username(s) from list of keys
                if (mentionKey !== props.user.username && mentionKey !== `@${props.user.username}`) {
                    customKeysWithNotification.push({
                        label: mentionKey,
                        value: mentionKey,
                    });
                }
            });

            // Check if username is in list of keys, if so, set the checkbox to true
            usernameKey = mentionKeys.includes(props.user.username);

            // Check if there are any keys in the list, if so, set the checkbox of custom keys to true
            isCustomKeysWithNotificationInputChecked = customKeysWithNotification.length > 0;
        }

        if (props.user.notify_props.highlight_keys) {
            const highlightKeys = props.user.notify_props.highlight_keys.split(',').filter((key) => key.length > 0);

            highlightKeys.forEach((highlightKey) => {
                customKeysWithHighlight.push({
                    label: highlightKey,
                    value: highlightKey,
                });
            });
        }

        if (props.user.notify_props.first_name) {
            firstNameKey = props.user.notify_props.first_name === 'true';
        }

        if (props.user.notify_props.channel) {
            channelKey = props.user.notify_props.channel === 'true';
        }
    }

    return {
        desktopActivity: desktop,
        desktopThreads,
        pushThreads,
        emailThreads,
        enableEmail,
        pushActivity,
        pushStatus,
        desktopSound: sound,
        callsDesktopSound: callsSound,
        desktopNotificationSound,
        callsNotificationSound,
        usernameKey,
        customKeysWithNotification,
        customKeysWithHighlight,
        isCustomKeysWithNotificationInputChecked,
        firstNameKey,
        channelKey,
        autoResponderActive,
        autoResponderMessage,
        notifyCommentsLevel: comments,
        isSaving: false,
        serverError: '',
    };
}

class NotificationsTab extends React.PureComponent<Props, State> {
    drawerRef: RefObject<HTMLHeadingElement>;
    wrapperRef: RefObject<HTMLDivElement>;

    static defaultProps = {
        activeSection: '',
    };

    constructor(props: Props) {
        super(props);

        this.state = getNotificationsStateFromProps(props);
        this.drawerRef = React.createRef();
        this.wrapperRef = React.createRef();
    }

    handleSubmit = async () => {
        const data: UserNotifyProps = {} as UserNotifyProps;
        data.email = this.state.enableEmail;
        data.desktop_sound = this.state.desktopSound;
        data.calls_desktop_sound = this.state.callsDesktopSound;
        data.desktop_notification_sound = this.state.desktopNotificationSound;
        data.calls_notification_sound = this.state.callsNotificationSound;
        data.desktop = this.state.desktopActivity;
        data.desktop_threads = this.state.desktopThreads;
        data.email_threads = this.state.emailThreads;
        data.push_threads = this.state.pushThreads;
        data.push = this.state.pushActivity;
        data.push_status = this.state.pushStatus;
        data.comments = this.state.notifyCommentsLevel;
        data.auto_responder_active = this.state.autoResponderActive.toString() as UserNotifyProps['auto_responder_active'];
        data.auto_responder_message = this.state.autoResponderMessage;
        data.first_name = this.state.firstNameKey.toString() as UserNotifyProps['first_name'];
        data.channel = this.state.channelKey.toString() as UserNotifyProps['channel'];

        if (!data.auto_responder_message || data.auto_responder_message === '') {
            data.auto_responder_message = this.props.intl.formatMessage({
                id: 'user.settings.notifications.autoResponderDefault',
                defaultMessage: 'Hello, I am out of office and unable to respond to messages.',
            });
        }

        const mentionKeys: string[] = [];
        if (this.state.usernameKey) {
            mentionKeys.push(this.props.user.username);
        }
        if (this.state.isCustomKeysWithNotificationInputChecked && this.state.customKeysWithNotification.length > 0) {
            this.state.customKeysWithNotification.forEach((key) => {
                mentionKeys.push(key.value);
            });
        }
        data.mention_keys = mentionKeys.join(',');

        const highlightKeys: string[] = [];
        if (this.state.customKeysWithHighlight.length > 0) {
            this.state.customKeysWithHighlight.forEach((key) => {
                highlightKeys.push(key.value);
            });
        }
        data.highlight_keys = highlightKeys.join(',');

        this.setState({isSaving: true});
        stopTryNotificationRing();

        const {data: updatedUser, error} = await this.props.updateMe({notify_props: data}) as ActionResult<Partial<UserProfile>, ServerError>;
        if (updatedUser) {
            this.handleUpdateSection('');
            this.setState(getNotificationsStateFromProps(this.props));
        } else if (error) {
            this.setState({serverError: error.message, isSaving: false});
        }
    };

    handleCancel = (): void => {
        this.setState(getNotificationsStateFromProps(this.props));
        stopTryNotificationRing();
    };

    handleUpdateSection = (section: string): void => {
        if (section) {
            this.props.updateSection(section);
        } else {
            this.props.updateSection('');
        }
        this.setState({isSaving: false});
        this.handleCancel();
    };

    setStateValue = (key: string, value: string | boolean): void => {
        const data: {[key: string]: string | boolean } = {};
        data[key] = value;
        this.setState((prevState) => ({...prevState, ...data}));
    };

    handleNotifyPushThread = (e: ChangeEvent<HTMLInputElement>): void => {
        const pushThreads = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        this.setState({pushThreads});
    };

    handleNotifyCommentsRadio = (notifyCommentsLevel: UserNotifyProps['comments'], e?: React.ChangeEvent): void => {
        this.setState({notifyCommentsLevel});
        a11yFocus(e?.currentTarget as HTMLElement);
    };

    handlePushRadio = (pushActivity: UserNotifyProps['push'], e?: React.ChangeEvent): void => {
        this.setState({pushActivity});
        a11yFocus(e?.currentTarget as HTMLElement);
    };

    handlePushStatusRadio = (pushStatus: UserNotifyProps['push_status'], e?: React.ChangeEvent): void => {
        this.setState({pushStatus});
        a11yFocus(e?.currentTarget as HTMLElement);
    };

    handleEmailRadio = (enableEmail: UserNotifyProps['email']): void => this.setState({enableEmail});

    handleChangeForUsernameKeyCheckbox = (event: ChangeEvent<HTMLInputElement>) => {
        const {target: {checked}} = event;
        this.setState({usernameKey: checked});
    };

    handleChangeForFirstNameKeyCheckbox = (event: ChangeEvent<HTMLInputElement>) => {
        const {target: {checked}} = event;
        this.setState({firstNameKey: checked});
    };

    handleChangeForChannelKeyCheckbox = (event: ChangeEvent<HTMLInputElement>) => {
        const {target: {checked}} = event;
        this.setState({channelKey: checked});
    };

    handleChangeForCustomKeysWithNotificationCheckbox = (event: ChangeEvent<HTMLInputElement>) => {
        const {target: {checked}} = event;
        this.setState({isCustomKeysWithNotificationInputChecked: checked});
    };

    handleChangeForCustomKeysWithNotificationInput = (values: ValueType<{ value: string }>) => {
        if (values && Array.isArray(values) && values.length > 0) {
            // Check the custom keys input checkbox when atleast a single key is entered
            if (this.state.isCustomKeysWithNotificationInputChecked === false) {
                this.setState({
                    isCustomKeysWithNotificationInputChecked: true,
                });
            }

            const customKeysWithNotification = values.
                map((value: MultiInputValue) => {
                    // Remove all spaces from the value
                    const formattedValue = value.value.trim().replace(/ /g, '');
                    return {value: formattedValue, label: formattedValue};
                }).
                filter((value) => value.value.length > 0);
            this.setState({customKeysWithNotification});
        } else {
            this.setState({
                isCustomKeysWithNotificationInputChecked: false,
                customKeysWithNotification: [],
            });
        }
    };

    handleChangeForCustomKeysWithHightlightInput = (values: ValueType<{ value: string }>) => {
        if (values && Array.isArray(values) && values.length > 0) {
            const customKeysWithHighlight = values.
                map((value: MultiInputValue) => {
                    // Remove all spaces from the value
                    const formattedValue = value.value.trim().replace(/ /g, '');
                    return {value: formattedValue, label: formattedValue};
                }).
                filter((value) => value.value.length > 0);
            this.setState({customKeysWithHighlight});
        } else {
            this.setState({
                customKeysWithHighlight: [],
            });
        }
    };

    createPushNotificationSection = () => {
        const active = this.props.activeSection === 'push';
        const inputs = [];
        let submit = null;
        let max = null;

        if (active) {
            if (this.props.sendPushNotifications) {
                const pushActivityRadio = [false, false, false];
                if (this.state.pushActivity === NotificationLevels.ALL) {
                    pushActivityRadio[0] = true;
                } else if (this.state.pushActivity === NotificationLevels.NONE) {
                    pushActivityRadio[2] = true;
                } else {
                    pushActivityRadio[1] = true;
                }

                const pushStatusRadio = [false, false, false];
                if (this.state.pushStatus === Constants.UserStatuses.ONLINE) {
                    pushStatusRadio[0] = true;
                } else if (this.state.pushStatus === Constants.UserStatuses.AWAY) {
                    pushStatusRadio[1] = true;
                } else {
                    pushStatusRadio[2] = true;
                }

                let pushThreadsNotificationSelection = null;
                if (this.props.isCollapsedThreadsEnabled && this.state.pushActivity === NotificationLevels.MENTION) {
                    pushThreadsNotificationSelection = (
                        <React.Fragment key='userNotificationPushThreadsOptions'>
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
                                            checked={this.state.pushThreads === NotificationLevels.ALL}
                                            onChange={this.handleNotifyPushThread}
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
                        </React.Fragment>
                    );
                }
                let pushStatusSettings;
                if (this.state.pushActivity !== NotificationLevels.NONE) {
                    pushStatusSettings = (
                        <React.Fragment key='userNotificationPushStatusOptions'>
                            <hr/>
                            <fieldset>
                                <legend className='form-legend'>
                                    <FormattedMessage
                                        id='user.settings.notifications.push_notification.status'
                                        defaultMessage='Trigger push notifications when'
                                    />
                                </legend>
                                <div className='radio'>
                                    <label>
                                        <input
                                            id='pushNotificationOnline'
                                            type='radio'
                                            name='pushNotificationStatus'
                                            checked={pushStatusRadio[0]}
                                            onChange={this.handlePushStatusRadio.bind(this, Constants.UserStatuses.ONLINE)}
                                        />
                                        <FormattedMessage
                                            id='user.settings.push_notification.online'
                                            defaultMessage='Online, away or offline'
                                        />
                                    </label>
                                </div>
                                <div className='radio'>
                                    <label>
                                        <input
                                            id='pushNotificationAway'
                                            type='radio'
                                            name='pushNotificationStatus'
                                            checked={pushStatusRadio[1]}
                                            onChange={this.handlePushStatusRadio.bind(this, Constants.UserStatuses.AWAY)}
                                        />
                                        <FormattedMessage
                                            id='user.settings.push_notification.away'
                                            defaultMessage='Away or offline'
                                        />
                                    </label>
                                </div>
                                <div className='radio'>
                                    <label>
                                        <input
                                            id='pushNotificationOffline'
                                            type='radio'
                                            name='pushNotificationStatus'
                                            checked={pushStatusRadio[2]}
                                            onChange={this.handlePushStatusRadio.bind(this, Constants.UserStatuses.OFFLINE)}
                                        />
                                        <FormattedMessage
                                            id='user.settings.push_notification.offline'
                                            defaultMessage='Offline'
                                        />
                                    </label>
                                </div>
                                <div className='mt-5'>
                                    <span>
                                        <FormattedMessage
                                            id='user.settings.push_notification.status_info'
                                            defaultMessage='Notification alerts are only pushed to your mobile device when your availability matches the selection above.'
                                        />
                                    </span>
                                </div>
                            </fieldset>
                        </React.Fragment>
                    );
                }

                inputs.push(
                    <div>
                        <fieldset key='userNotificationLevelOption'>
                            <legend className='form-legend'>
                                <FormattedMessage
                                    id='user.settings.push_notification.send'
                                    defaultMessage='Send mobile push notifications'
                                />
                            </legend>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='pushNotificationAllActivity'
                                        type='radio'
                                        name='pushNotificationLevel'
                                        checked={pushActivityRadio[0]}
                                        onChange={this.handlePushRadio.bind(this, NotificationLevels.ALL)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.push_notification.allActivity'
                                        defaultMessage='For all activity'
                                    />
                                </label>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='pushNotificationMentions'
                                        type='radio'
                                        name='pushNotificationLevel'
                                        checked={pushActivityRadio[1]}
                                        onChange={this.handlePushRadio.bind(this, NotificationLevels.MENTION)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.push_notification.onlyMentions'
                                        defaultMessage='For mentions and direct messages'
                                    />
                                </label>
                            </div>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='pushNotificationNever'
                                        type='radio'
                                        name='pushNotificationLevel'
                                        checked={pushActivityRadio[2]}
                                        onChange={this.handlePushRadio.bind(this, NotificationLevels.NONE)}
                                    />
                                    <FormattedMessage
                                        id='user.settings.notifications.never'
                                        defaultMessage='Never'
                                    />
                                </label>
                            </div>
                            <div className='mt-5'>
                                <FormattedMessage
                                    id='user.settings.push_notification.info'
                                    defaultMessage='Notification alerts are pushed to your mobile device when there is activity in Mattermost.'
                                />
                            </div>
                        </fieldset>
                    </div>,
                    pushStatusSettings,
                    pushThreadsNotificationSelection,
                );

                submit = this.handleSubmit;
            } else {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='pt-2'
                    >
                        <FormattedMessage
                            id='user.settings.push_notification.disabled_long'
                            defaultMessage='Push notifications have not been enabled by your System Administrator.'
                        />
                    </div>,
                );
            }
            max = (
                <SettingItemMax
                    title={this.props.intl.formatMessage({id: 'user.settings.notifications.push', defaultMessage: 'Mobile Push Notifications'})}
                    inputs={inputs}
                    submit={submit}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        let describe: JSX.Element;
        if (this.state.pushActivity === NotificationLevels.ALL) {
            if (this.state.pushStatus === Constants.UserStatuses.AWAY) {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.allActivityAway'
                        defaultMessage='For all activity when away or offline'
                    />
                );
            } else if (this.state.pushStatus === Constants.UserStatuses.OFFLINE) {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.allActivityOffline'
                        defaultMessage='For all activity when offline'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.allActivityOnline'
                        defaultMessage='For all activity when online, away or offline'
                    />
                );
            }
        } else if (this.state.pushActivity === NotificationLevels.NONE) {
            describe = (
                <FormattedMessage
                    id='user.settings.notifications.never'
                    defaultMessage='Never'
                />
            );
        } else if (this.props.sendPushNotifications) {
            if (this.state.pushStatus === Constants.UserStatuses.AWAY) { //eslint-disable-line no-lonely-if
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.onlyMentionsAway'
                        defaultMessage='For mentions and direct messages when away or offline'
                    />
                );
            } else if (this.state.pushStatus === Constants.UserStatuses.OFFLINE) {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.onlyMentionsOffline'
                        defaultMessage='For mentions and direct messages when offline'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.push_notification.onlyMentionsOnline'
                        defaultMessage='For mentions and direct messages when online, away or offline'
                    />
                );
            }
        } else {
            describe = (
                <FormattedMessage
                    id='user.settings.push_notification.disabled'
                    defaultMessage='Push notifications are not enabled'
                />
            );
        }

        return (
            <SettingItem
                title={this.props.intl.formatMessage({id: 'user.settings.notifications.push', defaultMessage: 'Mobile Push Notifications'})}
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                describe={describe}
                section={'push'}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    createKeywordsWithNotificationSection = () => {
        const serverError = this.state.serverError;
        const user = this.props.user;
        const isSectionExpanded = this.props.activeSection === 'keysWithNotification';

        let expandedSection = null;
        if (isSectionExpanded) {
            const inputs = [];

            if (user.first_name) {
                inputs.push(
                    <div key='userNotificationFirstNameOption'>
                        <div className='checkbox'>
                            <label>
                                <input
                                    id='notificationTriggerFirst'
                                    type='checkbox'
                                    checked={this.state.firstNameKey}
                                    onChange={this.handleChangeForFirstNameKeyCheckbox}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.sensitiveName'
                                    defaultMessage='Your case-sensitive first name "{first_name}"'
                                    values={{
                                        first_name: user.first_name,
                                    }}
                                />
                            </label>
                        </div>
                    </div>,
                );
            }

            inputs.push(
                <div key='userNotificationUsernameOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                id='notificationTriggerUsername'
                                type='checkbox'
                                checked={this.state.usernameKey}
                                onChange={this.handleChangeForUsernameKeyCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.sensitiveUsername'
                                defaultMessage='Your non case-sensitive username "{username}"'
                                values={{
                                    username: user.username,
                                }}
                            />
                        </label>
                    </div>
                </div>,
            );

            inputs.push(
                <div key='userNotificationChannelOption'>
                    <div className='checkbox'>
                        <label>
                            <input
                                id='notificationTriggerShouts'
                                type='checkbox'
                                checked={this.state.channelKey}
                                onChange={this.handleChangeForChannelKeyCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.channelWide'
                                defaultMessage='Channel-wide mentions "@channel", "@all", "@here"'
                            />
                        </label>
                    </div>
                </div>,
            );

            inputs.push(
                <div
                    key='userNotificationCustomOption'
                    className='customKeywordsWithNotificationSubsection'
                >
                    <div className='checkbox'>
                        <label>
                            <input
                                id='notificationTriggerCustom'
                                type='checkbox'
                                checked={this.state.isCustomKeysWithNotificationInputChecked}
                                onChange={this.handleChangeForCustomKeysWithNotificationCheckbox}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.sensitiveCustomWords'
                                defaultMessage='Other non case-sensitive words, press TAB to seperate keywords:'
                            />
                        </label>
                    </div>
                    <CreatableReactSelect
                        inputId='notificationTriggerCustomText'
                        autoFocus={true}
                        isClearable={false}
                        isMulti={true}
                        styles={customKeywordsWithNotificationStyles}
                        className='multiInput'
                        placeholder=''
                        components={{
                            DropdownIndicator: () => null,
                            Menu: () => null,
                            MenuList: () => null,
                        }}
                        aria-labelledby='notificationTriggerCustom'
                        onChange={this.handleChangeForCustomKeysWithNotificationInput}
                        value={this.state.customKeysWithNotification}
                    />
                </div>,
            );

            const extraInfo = (
                <FormattedMessage
                    id='user.settings.notifications.keywordsWithNotification.extraInfo'
                    defaultMessage='Notifications get triggered when someone sends a message that includes your username ("@{username}") or any of the options selected above.'
                    values={{
                        username: user.username,
                    }}
                />
            );

            expandedSection = (
                <SettingItemMax
                    title={this.props.intl.formatMessage({id: 'user.settings.notifications.keywordsWithNotification.title', defaultMessage: 'Keywords that trigger Notifications'})}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    saving={this.state.isSaving}
                    serverError={serverError}
                    extraInfo={extraInfo}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        const selectedMentionKeys = ['@' + user.username];
        if (this.state.firstNameKey) {
            selectedMentionKeys.push(user.first_name);
        }
        if (this.state.usernameKey) {
            selectedMentionKeys.push(user.username);
        }
        if (this.state.channelKey) {
            selectedMentionKeys.push('@channel');
            selectedMentionKeys.push('@all');
            selectedMentionKeys.push('@here');
        }
        if (this.state.customKeysWithNotification.length > 0) {
            const customKeysWithNotificationStringArray = this.state.customKeysWithNotification.map((key) => key.value);
            selectedMentionKeys.push(...customKeysWithNotificationStringArray);
        }
        const collapsedDescription = selectedMentionKeys.filter((key) => key.trim().length !== 0).map((key) => `"${key}"`).join(', ');

        return (
            <SettingItem
                title={this.props.intl.formatMessage({id: 'user.settings.notifications.keywordsWithNotification.title', defaultMessage: 'Keywords that trigger Notifications'})}
                section='keysWithNotification'
                active={isSectionExpanded}
                areAllSectionsInactive={this.props.activeSection === ''}
                describe={collapsedDescription}
                updateSection={this.handleUpdateSection}
                max={expandedSection}
            />);
    };

    createKeywordsWithHighlightSection = () => {
        const isSectionExpanded = this.props.activeSection === 'keysWithHighlight';

        let expandedSection = null;
        if (isSectionExpanded) {
            const inputs = [(
                <div
                    key='userNotificationHighlightOption'
                    className='customKeywordsWithNotificationSubsection'
                >
                    <label htmlFor='mentionKeysWithHighlightInput'>
                        <FormattedMessage
                            id='user.settings.notifications.keywordsWithHighlight.inputTitle'
                            defaultMessage='Enter keywords, press TAB to seperate them:'
                        />
                    </label>
                    <CreatableReactSelect
                        inputId='mentionKeysWithHighlightInput'
                        autoFocus={true}
                        isClearable={false}
                        isMulti={true}
                        styles={customKeywordsWithNotificationStyles}
                        className='multiInput'
                        components={{
                            DropdownIndicator: () => null,
                            Menu: () => null,
                            MenuList: () => null,
                        }}
                        placeholder=''
                        aria-labelledby='mentionKeysWithHighlightInput'
                        onChange={this.handleChangeForCustomKeysWithHightlightInput}
                        value={this.state.customKeysWithHighlight}
                    />
                </div>
            )];

            const extraInfo = (
                <FormattedMessage
                    id='user.settings.notifications.keywordsWithHighlight.extraInfo'
                    defaultMessage='These keywords will get be shown to you with a highlight when anyone sends a message that includes them.'
                />
            );

            expandedSection = (
                <SettingItemMax
                    title={this.props.intl.formatMessage({id: 'user.settings.notifications.keywordsWithHighlight.title', defaultMessage: 'Keywords That Get Highlighted (without notifications)'})}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    extraInfo={extraInfo}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        let collapsedDescription = '';
        if (this.state.customKeysWithHighlight.length > 0) {
            const customKeysWithHighlightStringArray = this.state.customKeysWithHighlight.map((key) => key.value);
            collapsedDescription = customKeysWithHighlightStringArray.map((key) => `"${key}"`).join(', ');
        } else {
            collapsedDescription = this.props.intl.formatMessage({id: 'user.settings.notifications.keywordsWithHighlight.none', defaultMessage: 'None'});
        }

        return (
            <SettingItem
                title={this.props.intl.formatMessage({id: 'user.settings.notifications.keywordsWithHighlight.title', defaultMessage: 'Keywords That Get Highlighted (without notifications)'})}
                section='keysWithHighlight'
                active={isSectionExpanded}
                areAllSectionsInactive={this.props.activeSection === ''}
                describe={collapsedDescription}
                updateSection={this.handleUpdateSection}
                max={expandedSection}
            />);
    };

    createCommentsSection = () => {
        const serverError = this.state.serverError;

        const active = this.props.activeSection === 'comments';
        let max = null;
        if (active) {
            const commentsActive = [false, false, false];
            if (this.state.notifyCommentsLevel === 'never') {
                commentsActive[2] = true;
            } else if (this.state.notifyCommentsLevel === 'root') {
                commentsActive[1] = true;
            } else {
                commentsActive[0] = true;
            }

            const inputs = [];

            inputs.push(
                <fieldset key='userNotificationLevelOption'>
                    <legend className='form-legend hidden-label'>
                        <FormattedMessage
                            id='user.settings.notifications.comments'
                            defaultMessage='Reply notifications'
                        />
                    </legend>
                    <div className='radio'>
                        <label>
                            <input
                                id='notificationCommentsAny'
                                type='radio'
                                name='commentsNotificationLevel'
                                checked={commentsActive[0]}
                                onChange={this.handleNotifyCommentsRadio.bind(this, 'any')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.commentsAny'
                                defaultMessage='Trigger notifications on messages in reply threads that I start or participate in'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='notificationCommentsRoot'
                                type='radio'
                                name='commentsNotificationLevel'
                                checked={commentsActive[1]}
                                onChange={this.handleNotifyCommentsRadio.bind(this, 'root')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.commentsRoot'
                                defaultMessage='Trigger notifications on messages in threads that I start'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='notificationCommentsNever'
                                type='radio'
                                name='commentsNotificationLevel'
                                checked={commentsActive[2]}
                                onChange={this.handleNotifyCommentsRadio.bind(this, 'never')}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.commentsNever'
                                defaultMessage="Do not trigger notifications on messages in reply threads unless I'm mentioned"
                            />
                        </label>
                    </div>
                </fieldset>,
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.notifications.commentsInfo'
                        defaultMessage="In addition to notifications for when you're mentioned, select if you would like to receive notifications on reply threads."
                    />
                </span>
            );

            max = (
                <SettingItemMax
                    title={this.props.intl.formatMessage({id: 'user.settings.notifications.comments', defaultMessage: 'Reply notifications'})}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    submit={this.handleSubmit}
                    saving={this.state.isSaving}
                    serverError={serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        let describe: JSX.Element;
        if (this.state.notifyCommentsLevel === 'never') {
            describe = (
                <FormattedMessage
                    id='user.settings.notifications.commentsNever'
                    defaultMessage="Do not trigger notifications on messages in reply threads unless I'm mentioned"
                />
            );
        } else if (this.state.notifyCommentsLevel === 'root') {
            describe = (
                <FormattedMessage
                    id='user.settings.notifications.commentsRoot'
                    defaultMessage='Trigger notifications on messages in threads that I start'
                />
            );
        } else {
            describe = (
                <FormattedMessage
                    id='user.settings.notifications.commentsAny'
                    defaultMessage='Trigger notifications on messages in reply threads that I start or participate in'
                />
            );
        }

        return (
            <SettingItem
                title={this.props.intl.formatMessage({id: 'user.settings.notifications.comments', defaultMessage: 'Reply notifications'})}
                active={active}
                describe={describe}
                section={'comments'}
                updateSection={this.handleUpdateSection}
                max={max}
                areAllSectionsInactive={this.props.activeSection === ''}
            />
        );
    };

    createAutoResponderSection = () => {
        const describe = this.state.autoResponderActive ? (
            <FormattedMessage
                id='user.settings.notifications.autoResponderEnabled'
                defaultMessage='Enabled'
            />
        ) : (
            <FormattedMessage
                id='user.settings.notifications.autoResponderDisabled'
                defaultMessage='Disabled'
            />
        );

        return (
            <SettingItem
                active={this.props.activeSection === 'auto-responder'}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={
                    <FormattedMessage
                        id='user.settings.notifications.autoResponder'
                        defaultMessage='Automatic Direct Message Replies'
                    />
                }
                describe={describe}
                section={'auto-responder'}
                updateSection={this.handleUpdateSection}
                max={(
                    <div>
                        <ManageAutoResponder
                            autoResponderActive={this.state.autoResponderActive}
                            autoResponderMessage={this.state.autoResponderMessage || ''}
                            updateSection={this.handleUpdateSection}
                            setParentState={this.setStateValue}
                            submit={this.handleSubmit}
                            error={this.state.serverError}
                            saving={this.state.isSaving}
                        />
                        <div className='divider-dark'/>
                    </div>
                )}
            />
        );
    };

    render() {
        const pushNotificationSection = this.createPushNotificationSection();
        const keywordsWithNotificationSection = this.createKeywordsWithNotificationSection();
        const keywordsWithHighlightSection = this.createKeywordsWithHighlightSection();
        const commentsSection = this.createCommentsSection();
        const autoResponderSection = this.createAutoResponderSection();

        return (
            <div id='notificationSettings'>
                <div className='modal-header'>
                    <button
                        id='closeButton'
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref={this.drawerRef}
                    >
                        <div className='modal-back'>
                            <LocalizedIcon
                                className='fa fa-angle-left'
                                ariaLabel={{
                                    id: t('generic_icons.collapse'),
                                    defaultMessage: 'Collapse Icon',
                                }}
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.notifications.title'
                            defaultMessage='Notification Settings'
                        />
                    </h4>
                </div>
                <div
                    ref={this.wrapperRef}
                    className='user-settings'
                >
                    <h3
                        id='notificationSettingsTitle'
                        className='tab-header'
                    >
                        <FormattedMessage
                            id='user.settings.notifications.header'
                            defaultMessage='Notifications'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    <DesktopNotificationSettings
                        activity={this.state.desktopActivity}
                        threads={this.state.desktopThreads}
                        sound={this.state.desktopSound}
                        callsSound={this.state.callsDesktopSound}
                        updateSection={this.handleUpdateSection}
                        setParentState={this.setStateValue}
                        submit={this.handleSubmit}
                        saving={this.state.isSaving}
                        cancel={this.handleCancel}
                        error={this.state.serverError}
                        active={this.props.activeSection === 'desktop'}
                        selectedSound={this.state.desktopNotificationSound || 'default'}
                        callsSelectedSound={this.state.callsNotificationSound || 'default'}
                        isCollapsedThreadsEnabled={this.props.isCollapsedThreadsEnabled}
                        areAllSectionsInactive={this.props.activeSection === ''}
                        isCallsRingingEnabled={this.props.isCallsRingingEnabled}
                    />
                    <div className='divider-light'/>
                    <EmailNotificationSetting
                        activeSection={this.props.activeSection}
                        updateSection={this.handleUpdateSection}
                        enableEmail={this.state.enableEmail === 'true'}
                        onSubmit={this.handleSubmit}
                        onCancel={this.handleCancel}
                        onChange={this.handleEmailRadio}
                        saving={this.state.isSaving}
                        serverError={this.state.serverError}
                        isCollapsedThreadsEnabled={this.props.isCollapsedThreadsEnabled}
                        setParentState={this.setStateValue}
                        threads={this.state.emailThreads || ''}
                    />
                    <div className='divider-light'/>
                    {pushNotificationSection}
                    <div className='divider-light'/>
                    {keywordsWithNotificationSection}
                    <div className='divider-light'/>
                    {keywordsWithHighlightSection}
                    <div className='divider-light'/>
                    {!this.props.isCollapsedThreadsEnabled && (
                        <>
                            {commentsSection}
                            <div className='divider-light'/>
                        </>
                    )}
                    {this.props.enableAutoResponder && (
                        autoResponderSection
                    )}
                    <div className='divider-dark'/>
                </div>
            </div>

        );
    }
}

const customKeywordsWithNotificationStyles: ReactSelectStyles = {
    indicatorSeparator: ((indicatorSeperatorStyles) => ({
        ...indicatorSeperatorStyles,
        display: 'none',
    })),
    multiValueRemove: ((multiValueRemoveStyles) => ({
        ...multiValueRemoveStyles,
        cursor: 'pointer',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.16)',
        },
    })),
};

export default injectIntl(NotificationsTab);
