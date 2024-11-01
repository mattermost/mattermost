// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ExternalLink from 'components/external_link';

import {DeveloperLinks} from 'utils/constants';

import {FIELD_IDS} from './constants';

import {useIsSetByEnv} from '../hooks';

const label = (
    <FormattedMessage
        id='admin.plugins.settings.requirePluginSignature'
        defaultMessage='Require Plugin Signature:'
    />
);
const helpText = (
    <FormattedMessage
        id='admin.plugins.settings.requirePluginSignatureDesc'
        defaultMessage='When true, uploading plugins is disabled and may only be installed through the Marketplace. Plugins are always verified during Mattermost server startup and initialization. See <link>documentation</link> to learn more.'
        values={{
            link: (msg: React.ReactNode) => (
                <ExternalLink
                    href={DeveloperLinks.PLUGIN_SIGNING}
                    location='plugin_management'
                >
                    {msg}
                </ExternalLink>
            ),
        }}
    />
);

type Props = {
    value: ComponentProps<typeof BooleanSetting>['value'];
    onChange: ComponentProps<typeof BooleanSetting>['onChange'];
    isDisabled?: boolean;
}
const RequirePluginSignature = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('PluginSettings.RequirePluginSignature');
    return (
        <BooleanSetting
            id={FIELD_IDS.REQUIRE_PLUGIN_SIGNATURE}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default RequirePluginSignature;
