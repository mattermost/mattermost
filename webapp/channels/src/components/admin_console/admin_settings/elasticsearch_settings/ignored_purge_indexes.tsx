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
        id='admin.elasticsearch.ignoredPurgeIndexes'
        defaultMessage='Indexes to skip while purging:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.elasticsearch.ignoredPurgeIndexesDescription'
        defaultMessage='When filled in, these indexes will be ignored during the purge, separated by commas.'
    />
);
const placeholder = defineMessage({
    id: 'admin.elasticsearch.ignoredPurgeIndexesDescription.example',
    defaultMessage: 'E.g.: .opendistro*,.security*',
});

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const IgnoredPurgeIndexes = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.IgnoredPurgeIndexes');
    return (
        <TextSetting
            id={FIELD_IDS.IGNORED_PURGE_INDEXES}
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

export default IgnoredPurgeIndexes;
