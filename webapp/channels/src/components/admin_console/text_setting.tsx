// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import TextSetting from 'components/widgets/settings/text_setting';
import type {Props as WidgetTextSettingProps} from 'components/widgets/settings/text_setting';

import SetByEnv from './set_by_env';

interface Props extends Omit<WidgetTextSettingProps, 'placeholder'> {
    setByEnv: boolean;
    disabled?: boolean;
    placeholder?: string | MessageDescriptor;
}

const AdminTextSetting: React.FunctionComponent<Props> = (props: Props): JSX.Element => {
    const {setByEnv, disabled, footer, placeholder, ...sharedProps} = props;
    const isTextDisabled = disabled || setByEnv;
    const intl = useIntl();

    let placeholderToUse;
    if (placeholder) {
        if (typeof placeholder === 'string') {
            placeholderToUse = placeholder;
        } else {
            placeholderToUse = intl.formatMessage(placeholder);
        }
    }

    return (
        <TextSetting
            {...sharedProps}
            labelClassName='col-sm-4'
            inputClassName='col-sm-8'
            disabled={isTextDisabled}
            footer={setByEnv ? <SetByEnv/> : footer}
            placeholder={placeholderToUse}
        />
    );
};

export default AdminTextSetting;
