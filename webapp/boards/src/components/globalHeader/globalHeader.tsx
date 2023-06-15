// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
//
import React, { useEffect, useState } from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {History} from 'history'

import HelpIcon from 'src/widgets/icons/help'
import store from 'src/store'

import {Constants} from 'src/constants'

import GlobalHeaderSettingsMenu from './globalHeaderSettingsMenu'

import './globalHeader.scss'

import ItpTimeViewer from '../itpTimeRecorder/itpTimeViewer'
type HeaderItemProps = {
    history: History<unknown>
}

const HeaderItems = (props: HeaderItemProps) => {
    const helpUrl = 'https://www.focalboard.com/fwlink/doc-boards.html?v=' + Constants.versionString

    return (
        <div className='GlobalHeaderComponent'>
            <span className='spacer'/>
            <ItpTimeViewer board={'test'}/>
            <a
                href={helpUrl}
                target='_blank'
                rel='noreferrer'
                className='GlobalHeaderComponent__button help-button'
            >
                <HelpIcon/>
            </a>
            <GlobalHeaderSettingsMenu history={props.history}/>
        </div>
    )
}

type Props = {
    history: History<unknown>
}

const GlobalHeader = (props: Props): JSX.Element => {
    return (
        <ReduxProvider store={store}>
            <HeaderItems history={props.history}/>
        </ReduxProvider>
    )
}

export default GlobalHeader
