// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages, injectIntl} from 'react-intl';

import type {AdminConfig, ClientLicense, EmailSettings} from '@mattermost/types/config';

import ExternalLink from 'components/external_link';

import {Constants, DocLinks} from 'utils/constants';

import DropdownSetting from './dropdown_setting';
import OLDAdminSettings from './old_admin_settings';
import type {BaseProps, BaseState} from './old_admin_settings';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

type Props = BaseProps & {
    config: AdminConfig;
    license: ClientLicense;
} & WrappedComponentProps;

type State = BaseState & {
    pushNotificationServer: string;
    pushNotificationServerType: EmailSettings['PushNotificationServerType'];
    pushNotificationServerLocation: EmailSettings['PushNotificationServerLocation'];
    agree: boolean;
    maxNotificationsPerChannel: number;
};

const PUSH_NOTIFICATIONS_OFF = 'off';
const PUSH_NOTIFICATIONS_MHPNS = 'mhpns';
const PUSH_NOTIFICATIONS_MTPNS = 'mtpns';
const PUSH_NOTIFICATIONS_CUSTOM = 'custom';
const PUSH_NOTIFICATIONS_LOCATION_US = 'us';
const PUSH_NOTIFICATIONS_LOCATION_DE = 'de';

const PUSH_NOTIFICATIONS_SERVER_DIC = {
    [PUSH_NOTIFICATIONS_LOCATION_US]: Constants.MHPNS_US,
    [PUSH_NOTIFICATIONS_LOCATION_DE]: Constants.MHPNS_DE,
};

const DROPDOWN_ID_SERVER_TYPE = 'pushNotificationServerType';
const DROPDOWN_ID_SERVER_LOCATION = 'pushNotificationServerLocation';

const messages = defineMessages({
    pushNotificationServer: {id: 'admin.environment.pushNotificationServer', defaultMessage: 'Push Notification Server'},
    pushTitle: {id: 'admin.email.pushTitle', defaultMessage: 'Enable Push Notifications: '},
    pushServerTitle: {id: 'admin.email.pushServerTitle', defaultMessage: 'Push Notification Server:'},
});

export const searchableStrings = [
    messages.pushNotificationServer,
    messages.pushTitle,
    messages.pushServerTitle,
];

class PushSettings extends OLDAdminSettings<Props, State> {
    canSave = () => {
        return this.state.pushNotificationServerType !== PUSH_NOTIFICATIONS_MHPNS || this.state.agree;
    };

    handleAgreeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            agree: e.target.checked,
        });
    };

    handleDropdownChange = (id: string, value: string) => {
        if (id === DROPDOWN_ID_SERVER_TYPE) {
            this.setState({
                agree: false,
            });

            if (value === PUSH_NOTIFICATIONS_MHPNS) {
                this.setState({
                    pushNotificationServer: PUSH_NOTIFICATIONS_SERVER_DIC[this.state.pushNotificationServerLocation],
                });
            } else if (value === PUSH_NOTIFICATIONS_MTPNS) {
                this.setState({
                    pushNotificationServer: Constants.MTPNS,
                });
            } else if (value === PUSH_NOTIFICATIONS_CUSTOM &&
                (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MTPNS ||
                this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS)) {
                this.setState({
                    pushNotificationServer: '',
                });
            }
        }

        if (id === DROPDOWN_ID_SERVER_LOCATION) {
            this.setState({
                pushNotificationServer: PUSH_NOTIFICATIONS_SERVER_DIC[value as EmailSettings['PushNotificationServerLocation']],
                pushNotificationServerLocation: value as EmailSettings['PushNotificationServerLocation'],
            });
        }

        this.handleChange(id, value);
    };

    getConfigFromState = (config: Props['config']) => {
        config.EmailSettings.SendPushNotifications = this.state.pushNotificationServerType !== PUSH_NOTIFICATIONS_OFF;
        config.EmailSettings.PushNotificationServer = this.state.pushNotificationServer.trim();
        config.TeamSettings.MaxNotificationsPerChannel = this.state.maxNotificationsPerChannel;

        return config;
    };

    getStateFromConfig(config: Props['config']) {
        let pushNotificationServerType: EmailSettings['PushNotificationServerType'] = PUSH_NOTIFICATIONS_CUSTOM;
        let agree = false;
        let pushNotificationServerLocation: EmailSettings['PushNotificationServerLocation'] = PUSH_NOTIFICATIONS_LOCATION_US;
        if (!config.EmailSettings.SendPushNotifications) {
            pushNotificationServerType = PUSH_NOTIFICATIONS_OFF;
        } else if (config.EmailSettings.PushNotificationServer === Constants.MHPNS_US &&
            this.props.license.IsLicensed === 'true' && this.props.license.MHPNS === 'true') {
            pushNotificationServerType = PUSH_NOTIFICATIONS_MHPNS;
            pushNotificationServerLocation = PUSH_NOTIFICATIONS_LOCATION_US;
            agree = true;
        } else if (config.EmailSettings.PushNotificationServer === Constants.MHPNS_DE &&
            this.props.license.IsLicensed === 'true' && this.props.license.MHPNS === 'true') {
            pushNotificationServerType = PUSH_NOTIFICATIONS_MHPNS;
            pushNotificationServerLocation = PUSH_NOTIFICATIONS_LOCATION_DE;
            agree = true;
        } else if (config.EmailSettings.PushNotificationServer === Constants.MTPNS) {
            pushNotificationServerType = PUSH_NOTIFICATIONS_MTPNS;
        }

        let pushNotificationServer = config.EmailSettings.PushNotificationServer;
        if (pushNotificationServerType === PUSH_NOTIFICATIONS_MTPNS) {
            pushNotificationServer = Constants.MTPNS;
        } else if (pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            pushNotificationServer = PUSH_NOTIFICATIONS_SERVER_DIC[pushNotificationServerLocation];
        }

        const maxNotificationsPerChannel = config.TeamSettings.MaxNotificationsPerChannel;

        return {
            pushNotificationServerType,
            pushNotificationServerLocation,
            pushNotificationServer,
            maxNotificationsPerChannel,
            agree,
        };
    }

    isPushNotificationServerSetByEnv = () => {
        // Assume that if one of these has been set using an environment variable,
        // all of them have been set that way
        return this.isSetByEnv('EmailSettings.SendPushNotifications') ||
            this.isSetByEnv('EmailSettings.PushNotificationServer');
    };

    renderTitle() {
        return (<FormattedMessage {...messages.pushNotificationServer}/>);
    }

    renderSettings = () => {
        const pushNotificationServerTypes = [];
        pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_OFF, text: this.props.intl.formatMessage({id: 'admin.email.pushOff', defaultMessage: 'Do not send push notifications'})});
        if (this.props.license.IsLicensed === 'true' && this.props.license.MHPNS === 'true') {
            pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_MHPNS, text: this.props.intl.formatMessage({id: 'admin.email.mhpns', defaultMessage: 'Use HPNS connection with uptime SLA to send notifications to iOS and Android apps'})});
        }
        pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_MTPNS, text: this.props.intl.formatMessage({id: 'admin.email.mtpns', defaultMessage: 'Use TPNS connection to send notifications to iOS and Android apps'})});
        pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_CUSTOM, text: this.props.intl.formatMessage({id: 'admin.email.selfPush', defaultMessage: 'Manually enter Push Notification Service location'})});

        let sendHelpText = null;
        let pushServerHelpText = null;
        if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_OFF) {
            sendHelpText = (
                <FormattedMessage
                    id='admin.email.pushOffHelp'
                    defaultMessage='Please see <link>documentation on push notifications</link> to learn more about setup options.'
                    values={{
                        link: (msg) => (
                            <ExternalLink
                                href={DocLinks.SETUP_PUSH_NOTIFICATIONS}
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            );
        } else if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            pushServerHelpText = (
                <FormattedMessage
                    id='admin.email.mhpnsHelp'
                    defaultMessage='Download <linkIOS>Mattermost iOS app</linkIOS> from iTunes. Download <linkAndroid>Mattermost Android app</linkAndroid> from Google Play. Learn more about the <linkHPNS>Mattermost Hosted Push Notification Service</linkHPNS>.'
                    values={{
                        linkIOS: (msg) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/ios-app/'
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkAndroid: (msg) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/android-app/'
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkHPNS: (msg) => (
                            <ExternalLink
                                href={DocLinks.SETUP_PUSH_NOTIFICATIONS}
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            );
        } else if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MTPNS) {
            pushServerHelpText = (
                <FormattedMessage
                    id='admin.email.mtpnsHelp'
                    defaultMessage='Download <linkIOS>Mattermost iOS app</linkIOS> from iTunes. Download <linkAndroid>Mattermost Android app</linkAndroid> from Google Play. Learn more about the <linkHPNS>Mattermost Hosted Push Notification Service</linkHPNS>.'
                    values={{
                        linkIOS: (msg) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/ios-app/'
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkAndroid: (msg) => (
                            <ExternalLink
                                href='https://mattermost.com/pl/android-app/'
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                        linkHPNS: (msg) => (
                            <ExternalLink
                                href={DocLinks.SETUP_PUSH_NOTIFICATIONS}
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            );
        } else {
            pushServerHelpText = (
                <FormattedMessage
                    id='admin.email.easHelp'
                    defaultMessage='Learn more about compiling and deploying your own mobile apps from an <link>Enterprise App Store</link>.'
                    values={{
                        link: (msg) => (
                            <ExternalLink
                                href='https://docs.mattermost.com/'
                                location='push_settings'
                            >
                                {msg}
                            </ExternalLink>
                        ),
                    }}
                />
            );
        }

        let tosCheckbox;
        if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            tosCheckbox = (
                <div className='form-group'>
                    <div className='col-sm-4'/>
                    <div className='col-sm-8'>
                        <input
                            type='checkbox'
                            checked={this.state.agree}
                            onChange={this.handleAgreeChange}
                            disabled={this.props.isDisabled}
                        />
                        <FormattedMessage
                            id='admin.email.agreeHPNS'
                            defaultMessage=' I understand and accept the Mattermost Hosted Push Notification Service <linkTerms>Terms of Service</linkTerms> and <linkPrivacy>Privacy Policy</linkPrivacy>.'
                            values={{
                                linkTerms: (msg) => (
                                    <ExternalLink
                                        href='https://mattermost.com/hpns-terms/'
                                        location='push_settings'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                linkPrivacy: (msg) => (
                                    <ExternalLink
                                        href='https://mattermost.com/data-processing-addendum/'
                                        location='push_settings'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </div>
                </div>
            );
        }

        let locationDropdown;
        if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            const pushNotificationServerLocations = [
                {value: PUSH_NOTIFICATIONS_LOCATION_US, text: this.props.intl.formatMessage({id: 'admin.email.pushServerLocationUS', defaultMessage: 'US'})},
                {value: PUSH_NOTIFICATIONS_LOCATION_DE, text: this.props.intl.formatMessage({id: 'admin.email.pushServerLocationDE', defaultMessage: 'Germany'})},
            ];

            locationDropdown = (
                <DropdownSetting
                    id={DROPDOWN_ID_SERVER_LOCATION}
                    values={pushNotificationServerLocations}
                    label={
                        <FormattedMessage
                            id='admin.email.pushServerLocationTitle'
                            defaultMessage='Push Notification Server location:'
                        />
                    }
                    value={this.state.pushNotificationServerLocation}
                    onChange={this.handleDropdownChange}
                    setByEnv={this.isPushNotificationServerSetByEnv()}
                    disabled={this.props.isDisabled}
                />
            );
        }

        return (
            <SettingsGroup>
                <DropdownSetting
                    id={DROPDOWN_ID_SERVER_TYPE}
                    values={pushNotificationServerTypes}
                    label={<FormattedMessage {...messages.pushTitle}/>}
                    value={this.state.pushNotificationServerType}
                    onChange={this.handleDropdownChange}
                    helpText={sendHelpText}
                    setByEnv={this.isPushNotificationServerSetByEnv()}
                    disabled={this.props.isDisabled}
                />
                {locationDropdown}
                {tosCheckbox}
                <TextSetting
                    id='pushNotificationServer'
                    label={<FormattedMessage {...messages.pushServerTitle}/>}
                    placeholder={defineMessage({id: 'admin.email.pushServerEx', defaultMessage: 'E.g.: "https://push-test.mattermost.com"'})}
                    helpText={pushServerHelpText}
                    value={this.state.pushNotificationServer}
                    onChange={this.handleChange}
                    disabled={this.props.isDisabled || this.state.pushNotificationServerType !== PUSH_NOTIFICATIONS_CUSTOM}
                    setByEnv={this.isSetByEnv('EmailSettings.PushNotificationServer')}
                />
                <TextSetting
                    id='maxNotificationsPerChannel'
                    type='number'
                    label={
                        <FormattedMessage
                            id='admin.team.maxNotificationsPerChannelTitle'
                            defaultMessage='Max Notifications Per Channel:'
                        />
                    }
                    placeholder={defineMessage({id: 'admin.team.maxNotificationsPerChannelExample', defaultMessage: 'E.g.: "1000"'})}
                    helpText={
                        <FormattedMessage
                            id='admin.team.maxNotificationsPerChannelDescription'
                            defaultMessage='Maximum total number of users in a channel before users typing messages, @all, @here, and @channel no longer send notifications because of performance.'
                        />
                    }
                    value={this.state.maxNotificationsPerChannel}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('TeamSettings.MaxNotificationsPerChannel')}
                    disabled={this.props.isDisabled}
                />
            </SettingsGroup>
        );
    };
}

export default injectIntl(PushSettings);
