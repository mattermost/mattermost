// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import CheckboxSetting from 'components/admin_console/checkbox_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.symbol}/>;

type Props = {
    value: ComponentProps<typeof CheckboxSetting>['defaultChecked'];
    onChange: ComponentProps<typeof CheckboxSetting>['onChange'];
    isDisabled?: ComponentProps<typeof CheckboxSetting>['disabled'];
}

const Symbol = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('PasswordSettings.Symbol');

    return (
        <CheckboxSetting
            id={FIELD_IDS.PASSWORD_SYMBOL}
            label={label}
            defaultChecked={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default Symbol;
