// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage} from 'react-intl'

import ErrorIllustration from 'src/svg/error-illustration'

import './guestNoBoards.scss'

const GuestNoBoards = () => {
    return (
        <div className='GuestNoBoards'>
            <div>
                <div className='title'>
                    <FormattedMessage
                        id='guest-no-board.title'
                        defaultMessage={'No boards yet'}
                    />
                </div>
                <div className='subtitle'>
                    <FormattedMessage
                        id='guest-no-board.subtitle'
                        defaultMessage={'You don\'t have access to any board in this team yet, please wait until somebody adds you to any board.'}
                    />
                </div>
                <ErrorIllustration/>
            </div>
        </div>
    )
}

export default React.memo(GuestNoBoards)
