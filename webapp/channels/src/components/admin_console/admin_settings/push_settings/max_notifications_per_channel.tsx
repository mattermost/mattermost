// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';

import {useIsSetByEnv} from '../hooks';

const label = (
    <FormattedMessage
        id='admin.team.maxNotificationsPerChannelTitle'
        defaultMessage='Max Notifications Per Channel:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.team.maxNotificationsPerChannelDescription'
        defaultMessage='Maximum total number of users in a channel before users typing messages, @all, @here, and @channel no longer send notifications because of performance.'
    />
);

const placeholder = defineMessage({
    id: 'admin.team.maxNotificationsPerChannelExample',
    defaultMessage: 'E.g.: "1000"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const MaxNotificationsPerChannel = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('TeamSettings.MaxNotificationsPerChannel');
    return (
        <TextSetting
            id={FIELD_IDS.MAX_NOTIFICATIONS_PER_CHANNEL}
            placeholder={placeholder}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default MaxNotificationsPerChannel;
