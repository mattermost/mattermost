// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react'
import {useIntl} from 'react-intl'

import './adminBadge.scss'

type Props = {
    permissions?: string[]
}

const AdminBadge = (props: Props) => {
    const intl = useIntl()

    if (!props.permissions) {
        return null
    }
    let text = ''
    if (props.permissions?.find((s) => s === 'manage_system')) {
        text = intl.formatMessage({id: 'AdminBadge.SystemAdmin', defaultMessage: 'Admin'})
    } else if (props.permissions?.find((s) => s === 'manage_team')) {
        text = intl.formatMessage({id: 'AdminBadge.TeamAdmin', defaultMessage: 'Team Admin'})
    } else {
        return null
    }
    return (
        <div className='AdminBadge'>
            <div className='AdminBadge__box'>
                {text}
            </div>
        </div>
    )
}

export default memo(AdminBadge)
