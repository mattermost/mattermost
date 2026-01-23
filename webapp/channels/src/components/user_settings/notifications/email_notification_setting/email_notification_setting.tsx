// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserNotifyProps} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {getEmailInterval} from 'mattermost-redux/utils/notify_props';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {Preferences, NotificationLevels} from 'utils/constants';
import {a11yFocus} from 'utils/utils';

const SECONDS_PER_MINUTE = 60;

type Props = {
    active: boolean;
    updateSection: (section: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    saving?: boolean;
    error?: string;
    setParentState: (key: string, value: any) => void;
    areAllSectionsInactive: boolean;
    isCollapsedThreadsEnabled: boolean;
    enableEmail: boolean;
    onChange: (enableEmail: UserNotifyProps['email']) => void;
    threads: string;
    currentUserId: string;
    emailInterval: number;
    sendEmailNotifications: boolean;
    enableEmailBatching: boolean;
    actions: {
        savePreferences: (currentUserId: string, emailIntervalPreference: PreferenceType[]) => Promise<ActionResult>;
    };
};

type State = {
    active: boolean;
    emailInterval: number;
    enableEmail: boolean;
    enableEmailBatching: boolean;
    sendEmailNotifications: boolean;
    newInterval: number;
};

export default class EmailNotificationSetting extends React.PureComponent<Props, State> {
    editButtonRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        const {
            emailInterval,
            enableEmail,
            enableEmailBatching,
            sendEmailNotifications,
            active,
        } = props;

        this.state = {
            active,
            emailInterval,
            enableEmail,
            enableEmailBatching,
            sendEmailNotifications,
            newInterval: getEmailInterval(enableEmail && sendEmailNotifications, enableEmailBatching, emailInterval),
        };

        this.editButtonRef = React.createRef();
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        const {
            emailInterval,
            enableEmail,
            enableEmailBatching,
            sendEmailNotifications,
            active,
        } = nextProps;

        // If we're re-opening this section, reset to defaults from props
        if (active && !prevState.active) {
            return {
                active,
                emailInterval,
                enableEmail,
                enableEmailBatching,
                sendEmailNotifications,
                newInterval: getEmailInterval(enableEmail && sendEmailNotifications, enableEmailBatching, emailInterval),
            };
        }

        if (sendEmailNotifications !== prevState.sendEmailNotifications ||
            enableEmailBatching !== prevState.enableEmailBatching ||
            emailInterval !== prevState.emailInterval ||
            active !== prevState.active
        ) {
            return {
                active,
                emailInterval,
                enableEmail,
                enableEmailBatching,
                sendEmailNotifications,
                newInterval: getEmailInterval(enableEmail && sendEmailNotifications, enableEmailBatching, emailInterval),
            };
        }

        return null;
    }

    focusEditButton(): void {
        this.editButtonRef.current?.focus();
    }

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enableEmail = e.currentTarget.getAttribute('data-enable-email')!;
        const newInterval = parseInt(e.currentTarget.getAttribute('data-email-interval')!, 10);

        this.setState({
            enableEmail: enableEmail === 'true',
            newInterval,
        });

        a11yFocus(e.currentTarget);

        this.props.onChange(enableEmail as UserNotifyProps['email']);
    };

    handleThreadsOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        this.props.setParentState('emailThreads', value);
    };

    handleSubmit = async () => {
        const {newInterval} = this.state;
        if (this.props.emailInterval === newInterval && this.props.enableEmail === this.state.enableEmail) {
            this.props.updateSection('');
        } else {
            // until the rest of the notification settings are moved to preferences, we have to do this separately
            const {currentUserId, actions} = this.props;
            const emailIntervalPreference = {
                user_id: currentUserId,
                category: Preferences.CATEGORY_NOTIFICATIONS,
                name: Preferences.EMAIL_INTERVAL,
                value: newInterval.toString(),
            };

            await actions.savePreferences(currentUserId, [emailIntervalPreference]);
        }

        this.props.onSubmit();
    };

    handleUpdateSection = (section?: string) => {
        if (section) {
            this.props.updateSection(section);
        } else {
            this.props.updateSection('');

            this.setState({
                enableEmail: this.props.enableEmail,
                newInterval: this.props.emailInterval,
            });
            this.props.onCancel();
        }
    };

    renderMinSettingView = () => {
        const {
            enableEmail,
            sendEmailNotifications,
        } = this.props;

        const {newInterval} = this.state;

        let description;
        if (!sendEmailNotifications) {
            description = (
                <FormattedMessage
                    id='user.settings.notifications.email.disabled'
                    defaultMessage='Email notifications are not enabled'
                />
            );
        } else if (enableEmail) {
            switch (newInterval) {
            case Preferences.INTERVAL_IMMEDIATE:
                if (this.props.enableEmailBatching) {
                    description = (
                        <FormattedMessage
                            id='user.settings.notifications.email.asSoonAsYouAreAwayForFiveMinutes'
                            defaultMessage='As soon as you’re away for 5 minutes'
                        />
                    );
                } else {
                    description = (
                        <FormattedMessage
                            id='user.settings.notifications.email.on'
                            defaultMessage='On'
                        />
                    );
                }
                break;
            case Preferences.INTERVAL_HOUR:
                description = (
                    <FormattedMessage
                        id='user.settings.notifications.email.everyHour'
                        defaultMessage='Every hour'
                    />
                );
                break;
            case Preferences.INTERVAL_FIFTEEN_MINUTES:
                description = (
                    <FormattedMessage
                        id='user.settings.notifications.email.everyXMinutes'
                        defaultMessage='Every {count, plural, one {minute} other {{count, number} minutes}}'
                        values={{count: newInterval / SECONDS_PER_MINUTE}}
                    />
                );
                break;
            default:
                description = this.props.enableEmailBatching ? (
                    <FormattedMessage
                        id='user.settings.notifications.email.never'
                        defaultMessage='Never'
                    />
                ) : (
                    <FormattedMessage
                        id='user.settings.notifications.email.off'
                        defaultMessage='Off'
                    />
                );
            }
        } else {
            description = this.props.enableEmailBatching ? (
                <FormattedMessage
                    id='user.settings.notifications.email.never'
                    defaultMessage='Never'
                />
            ) : (
                <FormattedMessage
                    id='user.settings.notifications.email.off'
                    defaultMessage='Off'
                />
            );
        }

        return (
            <SettingItemMin
                ref={this.editButtonRef}
                title={
                    <FormattedMessage
                        id='user.settings.notifications.emailNotifications'
                        defaultMessage='Email notifications'
                    />
                }
                describe={description}
                section={'email'}
                updateSection={this.handleUpdateSection}
            />
        );
    };

    renderMaxSettingView = () => {
        if (!this.props.sendEmailNotifications) {
            return (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.notifications.emailNotifications'
                            defaultMessage='Email notifications'
                        />
                    }
                    inputs={[
                        <div
                            key='oauthEmailInfo'
                            className='pt-2'
                        >
                            <FormattedMessage
                                id='user.settings.notifications.email.disabled_long'
                                defaultMessage='Email notifications have not been enabled by your System Administrator.'
                            />
                        </div>,
                    ]}
                    serverError={this.props.error}
                    section={'email'}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        const {newInterval} = this.state;
        let emailOptions = null;
        let emailInfo = null;
        let emailTitle = null;
        if (this.props.enableEmailBatching) {
            emailOptions = (
                <fieldset>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationImmediately'
                                type='radio'
                                name='emailNotifications'
                                checked={newInterval === Preferences.INTERVAL_IMMEDIATE}
                                data-enable-email={'true'}
                                data-email-interval={Preferences.INTERVAL_IMMEDIATE}
                                onChange={this.handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.asSoonAsYouAreAwayForFiveMinutes'
                                defaultMessage='As soon as you’re away for 5 minutes'
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationMinutes'
                                type='radio'
                                name='emailNotifications'
                                checked={newInterval === Preferences.INTERVAL_FIFTEEN_MINUTES}
                                data-enable-email={'true'}
                                data-email-interval={Preferences.INTERVAL_FIFTEEN_MINUTES}
                                onChange={this.handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.everyXMinutes'
                                defaultMessage='Every {count, plural, one {minute} other {{count, number} minutes}}'
                                values={{count: Preferences.INTERVAL_FIFTEEN_MINUTES / SECONDS_PER_MINUTE}}
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationHour'
                                type='radio'
                                name='emailNotifications'
                                checked={newInterval === Preferences.INTERVAL_HOUR}
                                data-enable-email={'true'}
                                data-email-interval={Preferences.INTERVAL_HOUR}
                                onChange={this.handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.everyHour'
                                defaultMessage='Every hour'
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationNever'
                                type='radio'
                                name='emailNotifications'
                                checked={newInterval === Preferences.INTERVAL_NEVER}
                                data-enable-email={'false'}
                                data-email-interval={Preferences.INTERVAL_NEVER}
                                onChange={this.handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.never'
                                defaultMessage='Never'
                            />
                        </label>
                    </div>
                </fieldset>
            );

            emailInfo = (
                <FormattedMessage
                    id='user.settings.notifications.emailBatchingInfo'
                    defaultMessage='Email notifications are sent for mentions and direct messages when you are offline or away for more than 5 minutes. If you choose to receive notifications every 15 minutes or every hour, notifications during that period will be combined into a single email.'
                />
            );

            emailTitle = ( // Renders only in case emails are batched
                <legend className='form-legend'>
                    <FormattedMessage
                        id='user.settings.notifications.email.send'
                        defaultMessage='Send email notifications'
                    />
                </legend>
            );
        } else {
            emailOptions = (
                <fieldset>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationImmediately'
                                type='radio'
                                name='emailNotifications'
                                checked={newInterval === Preferences.INTERVAL_IMMEDIATE}
                                data-enable-email={'true'}
                                data-email-interval={Preferences.INTERVAL_IMMEDIATE}
                                onChange={this.handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.on'
                                defaultMessage='On'
                            />
                        </label>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='emailNotificationNever'
                                type='radio'
                                name='emailNotifications'
                                checked={newInterval === Preferences.INTERVAL_NEVER}
                                data-enable-email={'false'}
                                data-email-interval={Preferences.INTERVAL_NEVER}
                                onChange={this.handleChange}
                            />
                            <FormattedMessage
                                id='user.settings.notifications.email.off'
                                defaultMessage='Off'
                            />
                        </label>
                    </div>
                </fieldset>
            );

            emailInfo = (
                <FormattedMessage
                    id='user.settings.notifications.emailInfo'
                    defaultMessage='When enabled, email notifications are sent for mentions and direct messages when you are offline or away for more than 5 minutes.'
                />
            );
        }

        let threadsNotificationSelection = null;
        if (this.props.isCollapsedThreadsEnabled && this.props.enableEmail) {
            threadsNotificationSelection = (
                <React.Fragment key='userNotificationEmailThreadsOptions'>
                    <hr/>
                    <fieldset>
                        <div className='checkbox single-checkbox'>
                            <label>
                                <input
                                    id='desktopThreadsNotificationAllActivity'
                                    type='checkbox'
                                    name='desktopThreadsNotificationLevel'
                                    checked={this.props.threads === NotificationLevels.ALL}
                                    onChange={this.handleThreadsOnChange}
                                />
                                <FormattedMessage
                                    id='user.settings.notifications.email.notifyForthreads'
                                    defaultMessage={'Notify me about replies to threads I’m following'}
                                />
                            </label>
                        </div>
                    </fieldset>
                </React.Fragment>
            );
        }

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.notifications.emailNotifications'
                        defaultMessage='Email notifications'
                    />
                }
                inputs={[
                    <fieldset key='userNotificationEmailOptions'>
                        {emailTitle}
                        {emailOptions}
                        <div className='mt-3'>
                            {emailInfo}
                        </div>
                    </fieldset>,
                    threadsNotificationSelection,
                ]}
                submit={this.handleSubmit}
                saving={this.props.saving}
                serverError={this.props.error}
                updateSection={this.handleUpdateSection}
            />
        );
    };

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    render() {
        if (this.props.active) {
            return this.renderMaxSettingView();
        }

        return this.renderMinSettingView();
    }
}
