// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.enableTermsOfServiceTitle}/>;
const helpText = (
    <FormattedMessage
        {...messages.enableTermsOfServiceHelp}
        values={{
            a: (chunks: string) => <Link to='/admin_console/site_config/customization'>{chunks}</Link>,
        }}
    />
);

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const CustomTermsOfServiceEnabled = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('SupportSettings.CustomTermsOfServiceEnabled');
    return (
        <BooleanSetting
            id={FIELD_IDS.TERMS_ENABLED}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default CustomTermsOfServiceEnabled;
