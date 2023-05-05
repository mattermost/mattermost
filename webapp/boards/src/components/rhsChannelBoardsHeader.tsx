// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage} from 'react-intl'

import {getCurrentChannel} from 'src/store/channels'
import {useAppSelector} from 'src/store/hooks'

import appBarIcon from 'static/app-bar-icon.png'

const RHSChannelBoardsHeader = () => {
    const currentChannel = useAppSelector(getCurrentChannel)

    if (!currentChannel) {
        return null
    }

    return (
        <div>
            <img
                className='boards-rhs-header-logo'
                src={appBarIcon}
            />
            <span>
                <FormattedMessage
                    id='rhs-channel-boards-header.title'
                    defaultMessage='Boards'
                />
            </span>
            <span className='style--none sidebar--right__title__subtitle'>{currentChannel.display_name}</span>
        </div>
    )
}

export default RHSChannelBoardsHeader
