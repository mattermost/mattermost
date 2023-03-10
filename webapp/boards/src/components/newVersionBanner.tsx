// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useEffect} from 'react'
import {FormattedMessage} from 'react-intl'

import wsClient from 'src/wsclient'

import './newVersionBanner.scss'

const NewVersionBanner = () => {
    const [appVersionChanged, setAppVersionChanged] = useState(false)
    useEffect(() => {
        wsClient.onAppVersionChangeHandler = setAppVersionChanged
    }, [])

    if (!appVersionChanged) {
        return null
    }

    const newVersionReload = (e: any) => {
        e.preventDefault()
        location.reload()
    }

    return (
        <div className='NewVersionBanner'>
            <a
                target='_blank'
                rel='noreferrer'
                onClick={newVersionReload}
            >
                <FormattedMessage
                    id='BoardPage.newVersion'
                    defaultMessage='A new version of Boards is available, click here to reload.'
                />
            </a>
        </div>
    )
}

export default NewVersionBanner
