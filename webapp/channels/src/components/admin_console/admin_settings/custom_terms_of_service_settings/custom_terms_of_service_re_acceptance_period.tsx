// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.termsOfServiceReAcceptanceTitle}/>;
const helpText = <FormattedMessage {...messages.termsOfServiceReAcceptanceHelp}/>;

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const CustomTermsOfServiceReAcceptancePeriod = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('SupportSettings.CustomTermsOfServiceReAcceptancePeriod');
    return (
        <TextSetting
            id={FIELD_IDS.RE_ACCEPTANCE_PERIOD}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
            type='number'
        />
    );
};

export default CustomTermsOfServiceReAcceptancePeriod;
