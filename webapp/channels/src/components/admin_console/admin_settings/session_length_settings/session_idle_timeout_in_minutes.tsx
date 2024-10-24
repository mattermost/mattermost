// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.sessionIdleTimeout}/>;
const placeholder = defineMessage({
    id: 'admin.service.sessionIdleTimeoutEx',
    defaultMessage: 'E.g.: "60"',
});
const helpText = <FormattedMessage {...messages.sessionIdleTimeoutDesc}/>;

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
    extendSessionLengthWithActivity: boolean;
}

const SessionIdleTimeoutInMinutes = ({
    onChange,
    value,
    isDisabled,
    extendSessionLengthWithActivity,
}: Props) => {
    const setByEnv = useIsSetByEnv('ServiceSettings.SessionIdleTimeoutInMinutes');
    const license = useSelector(getLicense);

    if (!license.Compliance || extendSessionLengthWithActivity) {
        return null;
    }

    return (
        <TextSetting
            id={FIELD_IDS.SESSION_IDLE_TIMEOUT_IN_MINUTES}
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

export default SessionIdleTimeoutInMinutes;
