// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.skipTLSVerificationTitle}/>;
const helpText = <FormattedMessage {...messages.skipTLSVerificationDescription}/>;

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const SkipTLSVerification = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.SkipTLSVerification');
    return (
        <BooleanSetting
            id={FIELD_IDS.SKIP_TLS_VERIFICATION}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default SkipTLSVerification;
