// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';

import {useIsSetByEnv} from '../hooks';

const label = (
    <FormattedMessage
        id='admin.elasticsearch.backendTitle'
        defaultMessage='Backend type:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.elasticsearch.backendDescription'
        defaultMessage='The type of the search backend.'
    />
);
const placeholder = defineMessage({
    id: 'admin.elasticsearch.backendExample',
    defaultMessage: 'E.g.: "elasticsearch"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const Backend = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.Backend');
    return (
        <TextSetting
            id={FIELD_IDS.BACKEND}
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

export default Backend;
