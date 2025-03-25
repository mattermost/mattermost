// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import './channel_settings_configuration_tab.scss';
import Toggle from "components/toggle";

function ChannelSettingsConfigurationTab() {
    const [channelBannerEnabled, setChannelBannerEnabled] = React.useState(false);

    const intl = useIntl();

    const heading = intl.formatMessage({id: 'channel_banner.label.name', defaultMessage: 'Channel Banner'});
    const subHeading = intl.formatMessage({id: 'channel_banner.label.subtext', defaultMessage: 'When enabled, a customized banner will display at the top of the channel.'});

    return (
        <div className='ChannelSettingsModal__configurationTab'>
            <div className='channel_banner_header'>
                <div className='channel_banner_header__text'>
                    <span
                        className='heading'
                        aria-label={heading}
                    >
                        {heading}
                    </span>
                    <span
                        className='subheading'
                        aria-label={subHeading}
                    >
                        {subHeading}
                    </span>
                </div>

                <div className='channel_banner_header__toggle'>
                    <Toggle
                        id='channelBannerToggle'
                        ariaLabel={heading}
                        size='btn-md'
                        disabled={false}
                        onToggle={() => setChannelBannerEnabled((x) => !x)}
                        toggled={channelBannerEnabled}
                        tabIndex={-1}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>
        </div>
    );
}

export default ChannelSettingsConfigurationTab;
