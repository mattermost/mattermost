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
        id='admin.elasticsearch.clientKeyTitle'
        defaultMessage='Client Certificate Key path:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.elasticsearch.clientKeyDescription'
        defaultMessage='(Optional) The key for the client certificate in the PEM format.'
    />
);
const placeholder = defineMessage({
    id: 'admin.elasticsearch.clientKeyExample',
    defaultMessage: 'E.g.: "./elasticsearch/client-key.pem"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const ClientKey = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.ClientKey');
    return (
        <TextSetting
            id={FIELD_IDS.CLIENT_KEY}
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

export default ClientKey;
