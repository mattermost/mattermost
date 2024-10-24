// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';
import ExternalLink from 'components/external_link';

import {DocLinks} from 'utils/constants';

import {FIELD_IDS, PUSH_NOTIFICATIONS_CUSTOM, PUSH_NOTIFICATIONS_MHPNS, PUSH_NOTIFICATIONS_MTPNS, PUSH_NOTIFICATIONS_OFF} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.pushServerTitle}/>;

const placeholder = defineMessage({
    id: 'admin.email.pushServerEx',
    defaultMessage: 'E.g.: "https://push-test.mattermost.com"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
    serverType: string;
}

const PushNotificationServer = ({
    onChange,
    value,
    isDisabled,
    serverType,
}: Props) => {
    const setByEnv = useIsSetByEnv('EmailSettings.PushNotificationServer');

    const helpText = useMemo(() => {
        if (serverType === PUSH_NOTIFICATIONS_OFF) {
            return undefined;
        }

        if (serverType === PUSH_NOTIFICATIONS_MHPNS) {
            return (
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
        }

        if (serverType === PUSH_NOTIFICATIONS_MTPNS) {
            return (
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
        }

        return (
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
    }, [serverType]);

    return (
        <TextSetting
            id={FIELD_IDS.PUSH_NOTIFICATION_SERVER}
            placeholder={placeholder}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled || serverType !== PUSH_NOTIFICATIONS_CUSTOM}
        />
    );
};

export default PushNotificationServer;
