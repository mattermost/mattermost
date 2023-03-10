// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './topBar.scss'
import {FormattedMessage} from 'react-intl'

import {Constants} from 'src/constants'

const TopBar = (): JSX.Element => {
    const feedbackUrl = 'https://www.focalboard.com/fwlink/feedback-boards.html?v=' + Constants.versionString
    return (
        <div
            className='TopBar'
        >
            <a
                className='link'
                href={feedbackUrl}
                target='_blank'
                rel='noreferrer'
            >
                <FormattedMessage
                    id='TopBar.give-feedback'
                    defaultMessage='Give feedback'
                />
            </a>
            <div className='versionFrame'>
                <div
                    className='version'
                    title={`v${Constants.versionString}`}
                >
                    {`v${Constants.versionString}`}
                </div>
            </div>
        </div>
    )
}

export default React.memo(TopBar)
