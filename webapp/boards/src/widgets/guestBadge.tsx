// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react'
import {FormattedMessage} from 'react-intl'

import './guestBadge.scss'

type Props = {
    show?: boolean
}

const GuestBadge = (props: Props) => {
    if (!props.show) {
        return null
    }
    return (
        <div className='GuestBadge'>
            <div className='GuestBadge__box'>
                <FormattedMessage
                    id='badge.guest'
                    defaultMessage='Guest'
                />
            </div>
        </div>
    )
}

export default memo(GuestBadge)
