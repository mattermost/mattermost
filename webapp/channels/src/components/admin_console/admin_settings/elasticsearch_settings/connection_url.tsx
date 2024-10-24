// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';
import ExternalLink from 'components/external_link';

import {DocLinks} from 'utils/constants';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.connectionUrlTitle}/>;
const helpText = (
    <FormattedMessage
        {...messages.connectionUrlDescription}
        values={{
            link: (chunks) => (
                <ExternalLink
                    location='elasticsearch_settings'
                    href={DocLinks.ELASTICSEARCH}
                >
                    {chunks}
                </ExternalLink>
            ),
        }}
    />
);
const placeholder = defineMessage({
    id: 'admin.elasticsearch.connectionUrlExample',
    defaultMessage: 'E.g.: "https://elasticsearch.example.org:9200"',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const ConnectionUrl = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.ConnectionURL');
    return (
        <TextSetting
            id={FIELD_IDS.CONNECTION_URL}
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

export default ConnectionUrl;
