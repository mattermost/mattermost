// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'

import {Card} from 'src/blocks/card'
import {Board} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'

import './table.scss'

import TableRow from './tableRow'

type Props = {
    board: Board
    activeView: BoardView
    cards: readonly Card[]
    selectedCardIds: string[]
    readonly: boolean
    cardIdToFocusOnRender: string
    showCard: (cardId?: string) => void
    addCard: (groupByOptionId?: string) => Promise<void>
    onCardClicked: (e: React.MouseEvent, card: Card) => void
    onDrop: (srcCard: Card, dstCard: Card) => void
}

const TableRows = (props: Props): JSX.Element => {
    const {board, cards, activeView} = props

    const onClickRow = useCallback((e: React.MouseEvent<HTMLDivElement>, card: Card) => {
        props.onCardClicked(e, card)
    }, [props.onCardClicked])

    return (
        <>
            {cards.map((card, idx) => {
                return (
                    <TableRow
                        key={card.id + card.updateAt}
                        board={board}
                        columnWidths={activeView.fields.columnWidths}
                        isManualSort={activeView.fields.sortOptions.length === 0}
                        groupById={activeView.fields.groupById}
                        visiblePropertyIds={activeView.fields.visiblePropertyIds}
                        collapsedOptionIds={activeView.fields.collapsedOptionIds}
                        card={card}
                        addCard={props.addCard}
                        isSelected={props.selectedCardIds.includes(card.id)}
                        focusOnMount={props.cardIdToFocusOnRender === card.id}
                        isLastCard={idx === (cards.length - 1)}
                        onClick={onClickRow}
                        showCard={props.showCard}
                        readonly={props.readonly}
                        onDrop={props.onDrop}
                    />)
            })}
        </>
    )
}

export default TableRows
