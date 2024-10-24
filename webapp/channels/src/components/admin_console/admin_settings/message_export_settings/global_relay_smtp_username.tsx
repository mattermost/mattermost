// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.globalRelaySMTPUsername_title}/>;
const helpText = <FormattedMessage {...messages.globalRelaySMTPUsername_description}/>;
const placeholder = defineMessage({
    id: 'admin.complianceExport.globalRelaySMTPUsername.example',
    defaultMessage: 'E.g.: "globalRelayUser"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const GlobalRelaySMTPUsername = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('DataRetentionSettings.GlobalRelaySettings.SMTPUsername');
    return (
        <TextSetting
            id={FIELD_IDS.GLOBAL_RELAY_SMTP_USERNAME}
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

export default GlobalRelaySMTPUsername;
