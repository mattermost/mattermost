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
        id='admin.complianceExport.globalRelayCustomSMTPPort.title'
        defaultMessage='SMTP Server Port:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.complianceExport.globalRelayCustomSMTPPort.description'
        defaultMessage='The SMTP server port that will receive your Global Relay EML.'
    />
);
const placeholder = defineMessage({
    id: 'admin.complianceExport.globalRelayCustomSMTPPort.example',
    defaultMessage: 'E.g.: "25"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const GlobalRelayCustomSMTPPort = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('DataRetentionSettings.GlobalRelaySettings.CustomSMTPPort');
    return (
        <TextSetting
            id={FIELD_IDS.GLOBAL_RELAY_CUSTOM_SMTP_PORT}
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

export default GlobalRelayCustomSMTPPort;
