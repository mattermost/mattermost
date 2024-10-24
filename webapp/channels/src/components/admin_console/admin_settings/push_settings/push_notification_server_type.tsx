// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import DropdownSetting from 'components/admin_console/dropdown_setting';
import ExternalLink from 'components/external_link';

import {DocLinks} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {FIELD_IDS, PUSH_NOTIFICATIONS_CUSTOM, PUSH_NOTIFICATIONS_MHPNS, PUSH_NOTIFICATIONS_MTPNS, PUSH_NOTIFICATIONS_OFF} from './constants';
import {messages} from './messages';

const label = <FormattedMessage {...messages.pushTitle}/>;
const helpText = (
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

type Props = {
    value: ComponentProps<typeof DropdownSetting>['value'];
    onChange: ComponentProps<typeof DropdownSetting>['onChange'];
    isDisabled?: ComponentProps<typeof DropdownSetting>['disabled'];
    isSetByEnv: boolean;
}

const PushNotificationServerLocation = ({
    onChange,
    value,
    isDisabled,
    isSetByEnv,
}: Props) => {
    const intl = useIntl();

    const MHPNSAvailable = useSelector((state: GlobalState) => {
        const license = getLicense(state);
        return license.IsLicensed === 'true' && license.MHPNS === 'true';
    });
    const isOff = value === PUSH_NOTIFICATIONS_OFF;

    const pushNotificationServerTypes = useMemo(() => {
        const result = [];
        result.push({value: PUSH_NOTIFICATIONS_OFF, text: intl.formatMessage({id: 'admin.email.pushOff', defaultMessage: 'Do not send push notifications'})});
        if (MHPNSAvailable) {
            result.push({value: PUSH_NOTIFICATIONS_MHPNS, text: intl.formatMessage({id: 'admin.email.mhpns', defaultMessage: 'Use HPNS connection with uptime SLA to send notifications to iOS and Android apps'})});
        }
        result.push({value: PUSH_NOTIFICATIONS_MTPNS, text: intl.formatMessage({id: 'admin.email.mtpns', defaultMessage: 'Use TPNS connection to send notifications to iOS and Android apps'})});
        result.push({value: PUSH_NOTIFICATIONS_CUSTOM, text: intl.formatMessage({id: 'admin.email.selfPush', defaultMessage: 'Manually enter Push Notification Service location'})});
        return result;
    }, [intl, MHPNSAvailable]);

    return (
        <DropdownSetting
            id={FIELD_IDS.PUSH_NOTIFICATION_SERVER_TYPE}
            values={pushNotificationServerTypes}
            label={label}
            helpText={isOff ? helpText : undefined}
            value={value}
            onChange={onChange}
            setByEnv={isSetByEnv}
            disabled={isDisabled}
        />
    );
};

export default PushNotificationServerLocation;
