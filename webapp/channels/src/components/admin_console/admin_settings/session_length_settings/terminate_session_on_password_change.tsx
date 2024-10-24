// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.terminateSessionsOnPasswordChange_label}/>;
const helpText = <FormattedMessage {...messages.terminateSessionsOnPasswordChange_helpText}/>;

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const TerminateSessionsOnPasswordChange = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ServiceSettings.TerminateSessionsOnPasswordChange');
    return (
        <BooleanSetting
            id={FIELD_IDS.TERMINATE_SESSIONS_ON_PASSWORD_CHANGE}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default TerminateSessionsOnPasswordChange;
