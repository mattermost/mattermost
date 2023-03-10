// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl, FormattedMessage} from 'react-intl'

import {Board} from 'src/blocks/board'
import Button from 'src/widgets/buttons/button'
import CompassIcon from 'src/widgets/icons/compassIcon'

import './boardSelectorItem.scss'

type Props = {
    item: Board
    currentChannel: string
    linkBoard: (board: Board) => void
    unlinkBoard: (board: Board) => void
}

const BoardSelectorItem = (props: Props) => {
    const {item, currentChannel} = props
    const intl = useIntl()
    const untitledBoardTitle = intl.formatMessage({id: 'ViewTitle.untitled-board', defaultMessage: 'Untitled board'})
    const resultTitle = item.title || untitledBoardTitle
    return (
        <div className='BoardSelectorItem'>
            <div className='BoardSelectorItem-info'>
                <div className='d-flex'>
                    <span className='icon'>{item.icon || <CompassIcon icon='product-boards'/>}</span>
                    <div className='resultTitle'>{resultTitle}</div>
                </div>
                <div className='resultDescription'>{item.description}</div>
            </div>
            <div className='linkUnlinkButton'>
                {item.channelId === currentChannel &&
                    <Button
                        onClick={() => props.unlinkBoard(item)}
                        emphasis='secondary'
                    >
                        <FormattedMessage
                            id='boardSelector.unlink'
                            defaultMessage='Unlink'
                        />
                    </Button>}
                {item.channelId !== currentChannel &&
                    <Button
                        onClick={() => props.linkBoard(item)}
                        emphasis='primary'
                    >
                        <FormattedMessage
                            id='boardSelector.link'
                            defaultMessage='Link'
                        />
                    </Button>}
            </div>
        </div>
    )
}
export default BoardSelectorItem
