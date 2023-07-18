// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {SuiteWindow} from 'src/types/index'

import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import {getCurrentTeam} from 'src/store/teams'
import {Board, createBoard} from 'src/blocks/board'
import {useAppSelector} from 'src/store/hooks'
import IconButton from 'src/widgets/buttons/iconButton'
import OptionsIcon from 'src/widgets/icons/options'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import CompassIcon from 'src/widgets/icons/compassIcon'

import {Permission} from 'src/constants'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import './rhsChannelBoardItem.scss'

const windowAny = (window as SuiteWindow)

type Props = {
    board: Board
}

const RHSChannelBoardItem = (props: Props) => {
    const intl = useIntl()
    const {id, title, icon, description, updateAt} = props.board

    const team = useAppSelector(getCurrentTeam)
    if (!team) {
        return null
    }

    const handleBoardClicked = (boardID: string) => {
        // send the telemetry information for the clicked board
        const extraData = {teamID: team.id, board: boardID}
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ClickChannelsRHSBoard, extraData)

        window.open(`${windowAny.frontendBaseURL}/team/${team.id}/${boardID}`, '_blank', 'noopener')
    }

    const onUnlinkBoard = async (board: Board) => {
        const newBoard = createBoard(board)
        newBoard.channelId = ''
        mutator.updateBoard(newBoard, board, 'unlinked channel')
    }

    const untitledBoardTitle = intl.formatMessage({id: 'ViewTitle.untitled-board', defaultMessage: 'Untitled board'})

    const markdownHtml = Utils.htmlFromMarkdown(description)

    return (
        <div
            onClick={() => handleBoardClicked(id)}
            className='RHSChannelBoardItem'
        >
            <div className='board-info'>
                {icon && <span className='icon'>{icon}</span>}
                <span className='title'>{title || untitledBoardTitle}</span>
                <MenuWrapper stopPropagationOnToggle={true}>
                    <IconButton icon={<OptionsIcon/>}/>
                    <Menu
                        position='left'
                    >
                        <BoardPermissionGate
                            boardId={id}
                            teamId={team.id}
                            permissions={[Permission.ManageBoardRoles]}
                        >
                            <Menu.Text
                                key={`unlinkBoard-${id}`}
                                id='unlinkBoard'
                                name={intl.formatMessage({id: 'rhs-boards.unlink-board', defaultMessage: 'Unlink board'})}
                                icon={<CompassIcon icon='link-variant-off'/>}
                                onClick={() => {
                                    onUnlinkBoard(props.board)
                                }}
                            />
                        </BoardPermissionGate>
                        <BoardPermissionGate
                            boardId={id}
                            teamId={team.id}
                            permissions={[Permission.ManageBoardRoles]}
                            invert={true}
                        >
                            <Menu.Text
                                key={`unlinkBoard-${id}`}
                                id='unlinkBoard'
                                disabled={true}
                                name={intl.formatMessage({id: 'rhs-boards.unlink-board1', defaultMessage: 'Unlink board'})}
                                icon={<CompassIcon icon='link-variant-off'/>}
                                onClick={() => {
                                    onUnlinkBoard(props.board)
                                }}
                                subText={intl.formatMessage({id: 'rhs-board-non-admin-msg', defaultMessage: "You're not an admin of the board"})}
                            />
                        </BoardPermissionGate>
                    </Menu>
                </MenuWrapper>
            </div>
            <div
                className='description'
                dangerouslySetInnerHTML={{__html: markdownHtml}}
            />
            <div className='date'>
                <FormattedMessage
                    id='rhs-boards.last-update-at'
                    defaultMessage='Last update at: {datetime}'
                    values={{datetime: Utils.displayDateTime(new Date(updateAt), intl as any)}}
                />
            </div>
        </div>
    )
}

export default RHSChannelBoardItem
