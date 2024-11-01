// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import DropdownSetting from 'components/admin_console/dropdown_setting';

import {FIELD_IDS, PUSH_NOTIFICATIONS_LOCATION_DE, PUSH_NOTIFICATIONS_LOCATION_US} from './constants';

const label = (
    <FormattedMessage
        id='admin.email.pushServerLocationTitle'
        defaultMessage='Push Notification Server location:'
    />
);

type Props = {
    value: ComponentProps<typeof DropdownSetting>['value'];
    onChange: ComponentProps<typeof DropdownSetting>['onChange'];
    isDisabled?: ComponentProps<typeof DropdownSetting>['disabled'];
    isMHPNS: boolean;
    isSetByEnv: boolean;
}

const PushNotificationServerLocation = ({
    onChange,
    value,
    isDisabled,
    isMHPNS,
    isSetByEnv,
}: Props) => {
    const intl = useIntl();

    const pushNotificationServerLocations = useMemo(() => [
        {value: PUSH_NOTIFICATIONS_LOCATION_US, text: intl.formatMessage({id: 'admin.email.pushServerLocationUS', defaultMessage: 'US'})},
        {value: PUSH_NOTIFICATIONS_LOCATION_DE, text: intl.formatMessage({id: 'admin.email.pushServerLocationDE', defaultMessage: 'Germany'})},
    ], [intl]);

    if (!isMHPNS) {
        return null;
    }

    return (
        <DropdownSetting
            id={FIELD_IDS.PUSH_NOTIFICATION_SERVER_LOCATION}
            values={pushNotificationServerLocations}
            label={label}
            value={value}
            onChange={onChange}
            setByEnv={isSetByEnv}
            disabled={isDisabled}
        />
    );
};

export default PushNotificationServerLocation;
