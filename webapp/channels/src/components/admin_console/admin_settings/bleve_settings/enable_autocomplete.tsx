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
        id='admin.bleve.enableAutocompleteTitle'
        defaultMessage='Enable Bleve for autocomplete queries:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.bleve.enableAutocompleteDescription'
        defaultMessage='When true, Bleve will be used for all autocompletion queries on users and channels using the latest index. Autocompletion results may be incomplete until a bulk index of the existing users and channels database is finished. When false, database autocomplete is used.'
    />
);

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
    indexingEnabled?: boolean;
}

const EnableAutocomplete = ({
    value,
    onChange,
    isDisabled,
    indexingEnabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('BleveSettings.EnableAutocomplete');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE_AUTOCOMPLETE}
            label={label}
            helpText={helpText}
            value={value}
            disabled={!indexingEnabled || isDisabled}
            onChange={onChange}
            setByEnv={setByEnv}
        />
    );
};

export default EnableAutocomplete;
