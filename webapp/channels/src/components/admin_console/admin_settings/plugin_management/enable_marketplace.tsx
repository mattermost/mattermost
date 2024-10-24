// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ExternalLink from 'components/external_link';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';

const label = <FormattedMessage {...messages.enableMarketplace}/>;
const helpText = (
    <FormattedMessage
        {...messages.enableMarketplaceDesc}
        values={{
            link: (msg: React.ReactNode) => (
                <ExternalLink
                    href='https://mattermost.com/pl/default-mattermost-marketplace.html'
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
const EnableMarketplace = ({
    value,
    onChange,
    isDisabled,
}: Props) => {
    const setByEnv = useIsSetByEnv('PluginSettings.EnableMarketplace');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE_MARKETPLACE}
            label={label}
            helpText={helpText}
            value={value}
            onChange={onChange}
            setByEnv={setByEnv}
            disabled={isDisabled}
        />
    );
};

export default EnableMarketplace;
