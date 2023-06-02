// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useMemo, useState} from 'react'

import {Board} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {BoardView} from 'src/blocks/boardView'
import octoClient from 'src/octoClient'
import {getVisibleAndHiddenGroups} from 'src/boardUtils'

import ViewHeader from 'src/components/viewHeader/viewHeader'
import ViewTitle from 'src/components/viewTitle'
import Kanban from 'src/components/kanban/kanban'
import Table from 'src/components/table/table'
import CalendarFullView from 'src/components/calendar/fullCalendar'
import Gallery from 'src/components/gallery/gallery'

import './boardTemplateSelectorPreview.scss'

type Props = {
    activeTemplate: Board|null
}

const BoardTemplateSelectorPreview = (props: Props) => {
    const {activeTemplate} = props
    const [activeView, setActiveView] = useState<BoardView|null>(null)
    const [activeTemplateCards, setActiveTemplateCards] = useState<Card[]>([])

    useEffect(() => {
        let isSubscribed = true
        if (activeTemplate) {
            setActiveTemplateCards([])
            setActiveView(null)
            setActiveTemplateCards([])
            octoClient.getAllBlocks(activeTemplate.id).then((blocks) => {
                if (isSubscribed) {
                    const cards = blocks.filter((b) => b.type === 'card')
                    const views = blocks.filter((b) => b.type === 'view').sort((a, b) => a.title.localeCompare(b.title))
                    if (views.length > 0) {
                        setActiveView(views[0] as BoardView)
                    }
                    if (cards.length > 0) {
                        setActiveTemplateCards(cards as Card[])
                    }
                }
            })
        }

        return () => {
            isSubscribed = false
        }
    }, [activeTemplate])

    const dateDisplayProperty = useMemo(() => {
        return activeTemplate?.cardProperties.find((o) => o.id === activeView?.fields.dateDisplayPropertyId)
    }, [activeView, activeTemplate])

    const groupByProperty = useMemo(() => {
        return activeTemplate?.cardProperties.find((o) => o.id === activeView?.fields.groupById) || activeTemplate?.cardProperties[0]
    }, [activeView, activeTemplate])

    const {visible: visibleGroups, hidden: hiddenGroups} = useMemo(() => {
        if (!activeView) {
            return {visible: [], hidden: []}
        }

        return getVisibleAndHiddenGroups(activeTemplateCards, activeView.fields.visibleOptionIds, activeView?.fields.hiddenOptionIds, groupByProperty)
    }, [activeTemplateCards, activeView, groupByProperty])

    if (!activeTemplate) {
        return null
    }

    return (
        <div className='BoardTemplateSelectorPreview'>
            {activeView &&
            <div className='top-head'>
                <ViewTitle
                    key={activeTemplate?.id + activeTemplate?.title}
                    board={activeTemplate}
                    readonly={true}
                />
                <ViewHeader
                    board={activeTemplate}
                    activeView={activeView}
                    cards={activeTemplateCards}
                    views={[activeView]}
                    groupByProperty={groupByProperty}
                    addCard={() => null}
                    addCardFromTemplate={() => null}
                    addCardTemplate={() => null}
                    editCardTemplate={() => null}
                    readonly={false}
                />
            </div>}

            {activeView?.fields.viewType === 'board' &&
            <Kanban
                board={activeTemplate}
                activeView={activeView}
                cards={activeTemplateCards}
                groupByProperty={groupByProperty}
                visibleGroups={visibleGroups}
                hiddenGroups={hiddenGroups}
                selectedCardIds={[]}
                readonly={false}
                onCardClicked={() => null}
                addCard={() => Promise.resolve()}
                addCardFromTemplate={() => Promise.resolve()}
                showCard={() => null}
                hiddenCardsCount={0}
                showHiddenCardCountNotification={() => null}
            />}
            {activeView?.fields.viewType === 'table' &&
            <Table
                board={activeTemplate}
                activeView={activeView}
                cards={activeTemplateCards}
                groupByProperty={groupByProperty}
                views={[activeView]}
                visibleGroups={visibleGroups}
                selectedCardIds={[]}
                readonly={false}
                cardIdToFocusOnRender={''}
                onCardClicked={() => null}
                addCard={() => Promise.resolve()}
                showCard={() => null}
                hiddenCardsCount={0}
                showHiddenCardCountNotification={() => null}
            />}
            {activeView?.fields.viewType === 'gallery' &&
            <Gallery
                board={activeTemplate}
                cards={activeTemplateCards}
                activeView={activeView}
                readonly={false}
                selectedCardIds={[]}
                onCardClicked={() => null}
                addCard={() => Promise.resolve()}
                hiddenCardsCount={0}
                showHiddenCardCountNotification={() => null}
            />}
            {activeView?.fields.viewType === 'calendar' &&
            <CalendarFullView
                board={activeTemplate}
                cards={activeTemplateCards}
                activeView={activeView}
                readonly={false}
                dateDisplayProperty={dateDisplayProperty}
                showCard={() => null}
                addCard={() => Promise.resolve()}
            />}
        </div>
    )
}

export default React.memo(BoardTemplateSelectorPreview)

