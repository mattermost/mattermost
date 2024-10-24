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
        id='admin.complianceExport.globalRelayCustomSMTPServerName.title'
        defaultMessage='SMTP Server Name:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.complianceExport.globalRelayCustomSMTPServerName.description'
        defaultMessage='The SMTP server name that will receive your Global Relay EML.'
    />
);
const placeholder = defineMessage({
    id: 'admin.complianceExport.globalRelayCustomSMTPServerName.example',
    defaultMessage: 'E.g.: "feeds.globalrelay.com"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const GlobalRelayCustomSMTPServerName = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('DataRetentionSettings.GlobalRelaySettings.CustomSMTPServerName');
    return (
        <TextSetting
            id={FIELD_IDS.GLOBAL_RELAY_CUSTOM_SMTP_SERVER_NAME}
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

export default GlobalRelayCustomSMTPServerName;
