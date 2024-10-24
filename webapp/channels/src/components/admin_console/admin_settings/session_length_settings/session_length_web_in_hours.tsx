// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.webSessionHours}/>;
const placeholder = defineMessage(messages.sessionHoursEx);

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
    extendSessionLengthWithActivity: boolean;
}

const SessionLengthWebInHours = ({
    onChange,
    value,
    isDisabled,
    extendSessionLengthWithActivity,
}: Props) => {
    const setByEnv = useIsSetByEnv('ServiceSettings.SessionLengthWebInHours');

    const helpText = useMemo(() => {
        const message = extendSessionLengthWithActivity ? messages.webSessionHoursDesc_extendLength : messages.webSessionHoursDesc;

        return <FormattedMessage {...message}/>;
    }, [extendSessionLengthWithActivity]);

    return (
        <TextSetting
            id={FIELD_IDS.SESSION_LENGTH_WEB_IN_HOURS}
            placeholder={placeholder}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
            type='number'
        />
    );
};

export default SessionLengthWebInHours;
