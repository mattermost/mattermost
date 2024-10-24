// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';

import {useIsSetByEnv} from '../hooks';

const label = (
    <FormattedMessage
        id='admin.elasticsearch.enableAutocompleteTitle'
        defaultMessage='Enable Elasticsearch for autocomplete queries:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.elasticsearch.enableAutocompleteDescription'
        defaultMessage='Requires a successful connection to the Elasticsearch server. When true, Elasticsearch will be used for all autocompletion queries on users and channels using the latest index. Autocompletion results may be incomplete until a bulk index of the existing users and channels database is finished. When false, database autocomplete is used.'
    />
);

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const EnableAutocomplete = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ElasticsearchSettings.EnableAutocomplete');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE_AUTOCOMPLETE}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default EnableAutocomplete;
