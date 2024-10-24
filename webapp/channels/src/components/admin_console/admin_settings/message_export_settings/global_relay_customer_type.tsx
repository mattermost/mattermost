// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import RadioSetting from 'components/admin_console/radio_setting';

import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.globalRelayCustomerType_title}/>;
const helpText = <FormattedMessage {...messages.globalRelayCustomerType_description}/>;

type Props = {
    value: ComponentProps<typeof RadioSetting>['value'];
    onChange: ComponentProps<typeof RadioSetting>['onChange'];
    isDisabled?: boolean;
}

const GlobalRelayCustomerType = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const intl = useIntl();
    const setByEnv = useIsSetByEnv('DataRetentionSettings.ExportFormat');

    const values = useMemo(() => [
        {value: 'A9', text: intl.formatMessage({id: 'admin.complianceExport.globalRelayCustomerType.a9.description', defaultMessage: 'A9/Type 9'})},
        {value: 'A10', text: intl.formatMessage({id: 'admin.complianceExport.globalRelayCustomerType.a10.description', defaultMessage: 'A10/Type 10'})},
        {value: 'CUSTOM', text: intl.formatMessage({id: 'admin.complianceExport.globalRelayCustomerType.custom.description', defaultMessage: 'Custom'})},
    ], [intl]);
    return (
        <RadioSetting
            id='globalRelayCustomerType'
            values={values}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default GlobalRelayCustomerType;
