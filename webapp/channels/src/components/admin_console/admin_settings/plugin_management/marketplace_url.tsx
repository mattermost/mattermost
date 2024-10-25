// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import TextSetting from 'components/admin_console/text_setting';
import ExternalLink from 'components/external_link';

import {DeveloperLinks} from 'utils/constants';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';
import type {MinimalTextSettingProps} from '../types';

const label = <FormattedMessage {...messages.marketplaceUrl}/>;

type Props = MinimalTextSettingProps & {
    enableUploads: boolean;
}

const MarketplaceUrl = ({
    value,
    enableUploads,
    ...otherProps
}: Props) => {
    const helpText = useMemo(() => {
        return (
            <div>
                {
                    value === '' && enableUploads &&
                    <div className='alert-warning'>
                        <i className='fa fa-warning'/>
                        <FormattedMessage
                            id='admin.plugins.settings.marketplaceUrlDesc.empty'
                            defaultMessage=' Marketplace URL is a required field.'
                        />
                    </div>
                }
                {
                    value !== '' && enableUploads &&
                    <FormattedMessage {...messages.marketplaceUrlDesc}/>
                }
                {
                    !enableUploads &&
                    <FormattedMessage
                        {...messages.uploadDisabledDesc}
                        values={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={DeveloperLinks.PLUGINS}
                                    location='plugin_management'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                }
            </div>
        );
    }, [enableUploads, value]);

    const setByEnv = useIsSetByEnv('PluginSettings.MarketplaceURL');
    return (
        <TextSetting
            id={FIELD_IDS.MARKETPLACE_URL}
            label={label}
            helpText={helpText}
            value={value}
            setByEnv={setByEnv}
            {...otherProps}
        />
    );
};

export default MarketplaceUrl;
