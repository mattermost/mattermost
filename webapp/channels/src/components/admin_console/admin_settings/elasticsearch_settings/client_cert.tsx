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
        id='admin.elasticsearch.clientCertTitle'
        defaultMessage='Client Certificate path:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.elasticsearch.clientCertDescription'
        defaultMessage='(Optional) The client certificate for the connection to the Elasticsearch server in the PEM format.'
    />
);
const placeholder = defineMessage({
    id: 'admin.elasticsearch.clientCertExample',
    defaultMessage: 'E.g.: "./elasticsearch/client-cert.pem"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const ClientCert = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.ClientCert');
    return (
        <TextSetting
            id={FIELD_IDS.CLIENT_CERT}
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

export default ClientCert;
