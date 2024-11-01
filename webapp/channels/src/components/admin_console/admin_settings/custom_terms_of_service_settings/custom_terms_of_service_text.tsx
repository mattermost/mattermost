// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';

import Constants from 'utils/constants';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.termsOfServiceTextTitle}/>;
const helpText = <FormattedMessage {...messages.termsOfServiceTextHelp}/>;

type Props = {
    value: ComponentProps<typeof TextSetting>['value'];
    onChange: ComponentProps<typeof TextSetting>['onChange'];
    isDisabled?: ComponentProps<typeof TextSetting>['disabled'];
}

const CustomTermsOfServiceText = ({
    onChange,
    value,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('SupportSettings.CustomTermsOfServiceText');
    return (
        <TextSetting
            id={FIELD_IDS.TERMS_TEXT}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            maxLength={Constants.MAX_TERMS_OF_SERVICE_TEXT_LENGTH}
            disabled={isDisabled}
            type='textarea'
        />
    );
};

export default CustomTermsOfServiceText;
