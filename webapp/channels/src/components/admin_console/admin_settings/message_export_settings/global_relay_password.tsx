// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.globalRelaySMTPPassword_title}/>;
const helpText = <FormattedMessage {...messages.globalRelaySMTPPassword_description}/>;
const placeholder = defineMessage({
    id: 'admin.complianceExport.globalRelaySMTPPassword.example',
    defaultMessage: 'E.g.: "globalRelayPassword"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const GlobalRelaySMTPPassword = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('DataRetentionSettings.GlobalRelaySettings.SMTPPassword');
    return (
        <TextSetting
            id={FIELD_IDS.GLOBAL_RELAY_SMTP_PASSWORD}
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

export default GlobalRelaySMTPPassword;
