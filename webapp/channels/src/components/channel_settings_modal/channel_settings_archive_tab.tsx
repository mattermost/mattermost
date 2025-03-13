// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type ChannelSettingsArchiveTabProps = {
    handleArchiveChannel: () => void;
};

const ChannelSettingsArchiveTab: React.FC<ChannelSettingsArchiveTabProps> = ({
    handleArchiveChannel,
}) => {
    return (
        <div className='ChannelSettingsModal__archiveTab'>
            <FormattedMessage
                id='channel_settings.archive.warning'
                defaultMessage='Archiving this channel will remove it from the channel list. Are you sure you want to proceed?'
            />
            <button
                type='button'
                className='btn btn-danger'
                onClick={handleArchiveChannel}
                id='channelSettingsArchiveChannelButton'
            >
                <FormattedMessage
                    id='channel_settings.archive.button'
                    defaultMessage='Archive Channel'
                />
            </button>
        </div>
    );
};

export default ChannelSettingsArchiveTab;
