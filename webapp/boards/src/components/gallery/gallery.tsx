// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo, useCallback} from 'react'
import {FormattedMessage} from 'react-intl'

import {Constants, Permission} from 'src/constants'
import HiddenCardCount from 'src/components/hiddenCardCount/hiddenCardCount'

import {Card} from 'src/blocks/card'
import {Board, IPropertyTemplate} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'

import './gallery.scss'
import GalleryCard from './galleryCard'

type Props = {
    board: Board
    cards: Card[]
    activeView: BoardView
    readonly: boolean
    addCard: (show: boolean) => Promise<void>
    selectedCardIds: string[]
    onCardClicked: (e: React.MouseEvent, card: Card) => void
    hiddenCardsCount: number
    showHiddenCardCountNotification: (show: boolean) => void
}

const Gallery = (props: Props): JSX.Element => {
    const {activeView, board, cards, hiddenCardsCount} = props
    const visiblePropertyTemplates = useMemo(() => {
        return board.cardProperties.filter(
            (template: IPropertyTemplate) => activeView.fields.visiblePropertyIds.includes(template.id),
        )
    }, [board.cardProperties, activeView.fields.visiblePropertyIds])

    const isManualSort = activeView.fields.sortOptions.length === 0

    const onDropToCard = useCallback((srcCard: Card, dstCard: Card) => {
        Utils.log(`onDropToCard: ${dstCard.title}`)
        const {selectedCardIds} = props

        const draggedCardIds = Array.from(new Set(selectedCardIds).add(srcCard.id))
        const description = draggedCardIds.length > 1 ? `drag ${draggedCardIds.length} cards` : 'drag card'

        // Update dstCard order
        let cardOrder = Array.from(new Set([...activeView.fields.cardOrder, ...cards.map((o) => o.id)]))
        const isDraggingDown = cardOrder.indexOf(srcCard.id) <= cardOrder.indexOf(dstCard.id)
        cardOrder = cardOrder.filter((id) => !draggedCardIds.includes(id))
        let destIndex = cardOrder.indexOf(dstCard.id)
        if (isDraggingDown) {
            destIndex += 1
        }
        cardOrder.splice(destIndex, 0, ...draggedCardIds)

        mutator.performAsUndoGroup(async () => {
            await mutator.changeViewCardOrder(board.id, activeView.id, activeView.fields.cardOrder, cardOrder, description)
        })
    }, [cards.map((o) => o.id).join(','), board.id, activeView.id, activeView.fields.cardOrder, props.selectedCardIds])

    const visibleTitle = activeView.fields.visiblePropertyIds.includes(Constants.titleColumnId)
    const visibleBadges = activeView.fields.visiblePropertyIds.includes(Constants.badgesColumnId)

    return (

        <div className='Gallery'>
            {cards.filter((c) => c.boardId === board.id).map((card) => {
                return (
                    <GalleryCard
                        key={card.id + card.updateAt}
                        card={card}
                        board={board}
                        onClick={props.onCardClicked}
                        visiblePropertyTemplates={visiblePropertyTemplates}
                        visibleTitle={visibleTitle}
                        visibleBadges={visibleBadges}
                        isSelected={props.selectedCardIds.includes(card.id)}
                        readonly={props.readonly}
                        onDrop={onDropToCard}
                        isManualSort={isManualSort}
                    />
                )
            })}

            {/* Add New row */}

            {!props.readonly &&
                <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                    <div
                        className='octo-gallery-new'
                        onClick={() => {
                            props.addCard(true)
                        }}
                    >
                        <FormattedMessage
                            id='TableComponent.plus-new'
                            defaultMessage='+ New'
                        />
                    </div>
                </BoardPermissionGate>
            }
            {hiddenCardsCount > 0 &&
            <div className='gallery-hidden-cards'>
                <HiddenCardCount
                    hiddenCardsCount={hiddenCardsCount}
                    showHiddenCardNotification={props.showHiddenCardCountNotification}
                />
            </div>}
        </div>
    )
}

export default Gallery
