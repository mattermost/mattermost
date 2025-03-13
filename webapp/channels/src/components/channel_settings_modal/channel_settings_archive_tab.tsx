// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type ChannelSettingsArchiveTabProps = {
    handleArchiveChannel: () => void;
}

/** TODOS:
 * 1. Add logic to avoid showing this section in town-square and off-topic channels
 * 2. Add logic to avoid showing this section in direct messages
 * 3. Add logic to avoid showing this section in group messages
 */
function ChannelSettingsArchiveTab({
    handleArchiveChannel,
}: ChannelSettingsArchiveTabProps) {
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
}

export default ChannelSettingsArchiveTab;
