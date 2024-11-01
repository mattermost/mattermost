// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import Constants from 'utils/constants';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.minimumLength}/>;
const helpText = (
    <FormattedMessage
        {...messages.minimumLengthDescription}
        values={{
            min: Constants.MIN_PASSWORD_LENGTH,
            max: Constants.MAX_PASSWORD_LENGTH,
        }}
    />
);

const placeholder = defineMessage({
    id: 'admin.password.minimumLengthExample',
    defaultMessage: 'E.g.: "5"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const PasswordMinimumLength = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('PasswordSettings.MinimumLength');
    return (
        <TextSetting
            id={FIELD_IDS.PASSWORD_MINIMUM_LENGTH}
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

export default PasswordMinimumLength;
