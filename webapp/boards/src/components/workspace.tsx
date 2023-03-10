// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useState} from 'react'
import {generatePath, useRouteMatch, useHistory} from 'react-router-dom'
import {FormattedMessage} from 'react-intl'

import {DatePropertyType} from 'src/properties/types'

import {getCurrentBoard, isLoadingBoard, getTemplates} from 'src/store/boards'
import {
    refreshCards,
    getCardLimitTimestamp,
    getCurrentBoardHiddenCardsCount,
    setLimitTimestamp,
    getCurrentViewCardsSortedFilteredAndGrouped,
    setCurrent as setCurrentCard
} from 'src/store/cards'
import {
    getCurrentBoardViews,
    getCurrentViewGroupBy,
    getCurrentViewId,
    getCurrentViewDisplayBy,
    getCurrentView,
} from 'src/store/views'
import {useAppSelector, useAppDispatch} from 'src/store/hooks'

import {getClientConfig, setClientConfig} from 'src/store/clientConfig'

import wsClient, {WSClient} from 'src/wsclient'
import {ClientConfig} from 'src/config/clientConfig'
import {Utils} from 'src/utils'
import {IUser} from 'src/user'
import propsRegistry from 'src/properties'

import {getMe} from 'src/store/users'

import {getHiddenBoardIDs} from 'src/store/sidebar'

import CenterPanel from './centerPanel'
import BoardTemplateSelector from './boardTemplateSelector/boardTemplateSelector'
import GuestNoBoards from './guestNoBoards'

import Sidebar from './sidebar/sidebar'

import './workspace.scss'

type Props = {
    readonly: boolean
}

function CenterContent(props: Props) {
    const isLoading = useAppSelector(isLoadingBoard)
    const match = useRouteMatch<{boardId: string, viewId: string, cardId?: string, channelId?: string}>()
    const board = useAppSelector(getCurrentBoard)
    const templates = useAppSelector(getTemplates)
    const cards = useAppSelector(getCurrentViewCardsSortedFilteredAndGrouped)
    const activeView = useAppSelector(getCurrentView)
    const views = useAppSelector(getCurrentBoardViews)
    const groupByProperty = useAppSelector(getCurrentViewGroupBy)
    const dateDisplayProperty = useAppSelector(getCurrentViewDisplayBy)
    const clientConfig = useAppSelector(getClientConfig)
    const hiddenCardsCount = useAppSelector(getCurrentBoardHiddenCardsCount)
    const cardLimitTimestamp = useAppSelector(getCardLimitTimestamp)
    const history = useHistory()
    const dispatch = useAppDispatch()
    const me = useAppSelector<IUser|null>(getMe)
    const hiddenBoardIDs = useAppSelector(getHiddenBoardIDs)

    const isBoardHidden = () => {
        return hiddenBoardIDs.includes(board.id)
    }

    const showCard = useCallback((cardId?: string) => {
        const params = {...match.params, cardId}
        let newPath = generatePath(Utils.getBoardPagePath(match.path), params)
        if (props.readonly) {
            newPath += `?r=${Utils.getReadToken()}`
        }
        history.push(newPath)
        dispatch(setCurrentCard(cardId || ''))
    }, [match, history])

    useEffect(() => {
        const onConfigChangeHandler = (_: WSClient, config: ClientConfig) => {
            dispatch(setClientConfig(config))
        }
        wsClient.addOnConfigChange(onConfigChangeHandler)

        const onCardLimitTimestampChangeHandler = (_: WSClient, timestamp: number) => {
            dispatch(setLimitTimestamp({timestamp, templates}))
            if (cardLimitTimestamp > timestamp) {
                dispatch(refreshCards(timestamp))
            }
        }
        wsClient.addOnCardLimitTimestampChange(onCardLimitTimestampChangeHandler)

        return () => {
            wsClient.removeOnConfigChange(onConfigChangeHandler)
        }
    }, [cardLimitTimestamp, match.params.boardId, templates])

    const templateSelector = (
        <BoardTemplateSelector
            title={
                <FormattedMessage
                    id='BoardTemplateSelector.plugin.no-content-title'
                    defaultMessage='Create a board'
                />
            }
            description={
                <FormattedMessage
                    id='BoardTemplateSelector.plugin.no-content-description'
                    defaultMessage='Add a board to the sidebar using any of the templates defined below or start from scratch.'
                />
            }
            channelId={match.params.channelId}
        />
    )

    if (match.params.channelId) {
        if (me?.is_guest) {
            return <GuestNoBoards/>
        }
        return templateSelector
    }

    if (board && !isBoardHidden() && activeView) {
        let property = groupByProperty
        if ((!property || !propsRegistry.get(property.type).canGroup) && activeView.fields.viewType === 'board') {
            property = board?.cardProperties.find((o) => propsRegistry.get(o.type).canGroup)
        }

        let displayProperty = dateDisplayProperty
        if (!displayProperty && activeView.fields.viewType === 'calendar') {
            displayProperty = board.cardProperties.find((o) => propsRegistry.get(o.type) instanceof DatePropertyType)
        }

        return (
            <CenterPanel
                clientConfig={clientConfig}
                readonly={props.readonly}
                board={board}
                cards={cards}
                shownCardId={match.params.cardId}
                showCard={showCard}
                activeView={activeView}
                groupByProperty={property}
                dateDisplayProperty={displayProperty}
                views={views}
                hiddenCardsCount={hiddenCardsCount}
            />
        )
    }

    if ((board && !isBoardHidden()) || isLoading) {
        return null
    }

    if (me?.is_guest) {
        return <GuestNoBoards/>
    }

    return templateSelector
}

const Workspace = (props: Props) => {
    const board = useAppSelector(getCurrentBoard)

    const viewId = useAppSelector(getCurrentViewId)
    const [boardTemplateSelectorOpen, setBoardTemplateSelectorOpen] = useState(false)

    const closeBoardTemplateSelector = useCallback(() => {
        setBoardTemplateSelectorOpen(false)
    }, [])
    const openBoardTemplateSelector = useCallback(() => {
        if (board) {
            setBoardTemplateSelectorOpen(true)
        }
    }, [board])
    useEffect(() => {
        setBoardTemplateSelectorOpen(false)
    }, [board, viewId])

    return (
        <div className='Workspace'>
            {!props.readonly &&
                <Sidebar
                    onBoardTemplateSelectorOpen={openBoardTemplateSelector}
                    onBoardTemplateSelectorClose={closeBoardTemplateSelector}
                    activeBoardId={board?.id}
                />
            }
            <div className='mainFrame'>
                {boardTemplateSelectorOpen &&
                    <BoardTemplateSelector onClose={closeBoardTemplateSelector}/>}
                {(board?.isTemplate) &&
                <div className='banner'>
                    <FormattedMessage
                        id='Workspace.editing-board-template'
                        defaultMessage="You're editing a board template."
                    />
                </div>}
                <CenterContent
                    readonly={props.readonly}
                />
            </div>
        </div>
    )
}

export default React.memo(Workspace)
