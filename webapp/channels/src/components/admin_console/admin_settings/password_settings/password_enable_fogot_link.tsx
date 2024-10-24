// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BlockableLink from 'components/admin_console/blockable_link';
import BooleanSetting from 'components/admin_console/boolean_setting';

import {FIELD_IDS} from './constants';

const label = (
    <FormattedMessage
        id='admin.password.enableForgotLink.title'
        defaultMessage='Enable Forgot Password Link:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.password.enableForgotLink.description'
        defaultMessage='When true, “Forgot password” link appears on the Mattermost login page, which allows users to reset their password. When false, the link is hidden from users. This link can be customized to redirect to a URL of your choice from <a>Site Configuration > Customization.</a>'
        values={{
            a: (chunks) => (
                <BlockableLink to='/admin_console/site_config/customization'>
                    {chunks}
                </BlockableLink>
            ),
        }}
    />
);

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const PasswordEnableForgotLink = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    return (
        <BooleanSetting
            id={FIELD_IDS.PASSWORD_ENABLE_FORGOT_LINK}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={false}
            disabled={isDisabled}
        />
    );
};

export default PasswordEnableForgotLink;
