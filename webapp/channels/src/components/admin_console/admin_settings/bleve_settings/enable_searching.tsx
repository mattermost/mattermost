// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.enableSearchingTitle}/>;
const helpText = <FormattedMessage {...messages.enableSearchingDescription}/>;

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
    indexingEnabled?: boolean;
}
const EnableSearching = ({
    value,
    onChange,
    isDisabled,
    indexingEnabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('BleveSettings.EnableSearching');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE_SEARCHING}
            label={label}
            helpText={helpText}
            value={value}
            disabled={!indexingEnabled || isDisabled}
            onChange={onChange}
            setByEnv={setByEnv}
        />
    );
};

export default EnableSearching;
