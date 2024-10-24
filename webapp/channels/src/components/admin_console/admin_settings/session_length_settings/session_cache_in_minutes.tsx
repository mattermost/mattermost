// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.sessionCache}/>;
const placeholder = defineMessage({
    id: 'admin.service.sessionMinutesEx',
    defaultMessage: 'E.g.: "10"',
});
const helpText = <FormattedMessage {...messages.sessionCacheDesc}/>;

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const SessionCacheInMinutes = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ServiceSettings.SessionCacheInMinutes');

    return (
        <TextSetting
            id={FIELD_IDS.SESSION_CACHE_IN_MINUTES}
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

export default SessionCacheInMinutes;
