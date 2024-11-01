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
        id='admin.elasticsearch.caTitle'
        defaultMessage='CA path:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.elasticsearch.caDescription'
        defaultMessage='(Optional) Custom Certificate Authority certificates for the Elasticsearch server. Leave this empty to use the default CAs from the operating system.'
    />
);
const placeholder = defineMessage({
    id: 'admin.elasticsearch.caExample',
    defaultMessage: 'E.g.: "./elasticsearch/ca.pem"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const Ca = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.CA');
    return (
        <TextSetting
            id={FIELD_IDS.CA}
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

export default Ca;
