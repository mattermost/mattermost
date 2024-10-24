// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.extendSessionLengthActivity_label}/>;
const helpText = <FormattedMessage {...messages.extendSessionLengthActivity_helpText}/>;

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const ExtendSessionLengthWithActivity = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('ServiceSettings.ExtendSessionLengthWithActivity');
    return (
        <BooleanSetting
            id={FIELD_IDS.EXTEND_SESSION_LENGTH_WITH_ACTIVITY}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default ExtendSessionLengthWithActivity;
