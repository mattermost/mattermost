// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.usernameTitle}/>;
const helpText = <FormattedMessage {...messages.usernameDescription}/>;
const placeholder = defineMessage({
    id: 'admin.elasticsearch.usernameExample',
    defaultMessage: 'E.g.: "elastic"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const Username = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.Username');
    return (
        <TextSetting
            id={FIELD_IDS.USERNAME}
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

export default Username;
