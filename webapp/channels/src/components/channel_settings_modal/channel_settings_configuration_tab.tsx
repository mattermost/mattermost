// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

const ChannelSettingsConfigurationTab: React.FC = () => {
    return (
        <div className='ChannelSettingsModal__configurationTab'>
            <FormattedMessage
                id='channel_settings.configuration.placeholder'
                defaultMessage='Channel Permissions or Additional Configuration (WIP)'
            />
        </div>
    );
};

export default ChannelSettingsConfigurationTab;
