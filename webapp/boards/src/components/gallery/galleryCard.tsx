// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useMemo, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {ContentBlock} from 'src/blocks/contentBlock'
import {useSortable} from 'src/hooks/sortable'
import mutator from 'src/mutator'
import {getCardContents} from 'src/store/contents'
import {useAppSelector} from 'src/store/hooks'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'
import MenuWrapper from 'src/widgets/menuWrapper'
import Tooltip from 'src/widgets/tooltip'
import {CardDetailProvider} from 'src/components/cardDetail/cardDetailContext'
import ContentElement from 'src/components/content/contentElement'
import ImageElement from 'src/components/content/imageElement'
import PropertyValueElement from 'src/components/propertyValueElement'
import './galleryCard.scss'
import CardBadges from 'src/components/cardBadges'
import CardActionsMenu from 'src/components/cardActionsMenu/cardActionsMenu'
import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from 'src/components/confirmationDialogBox'
import CardActionsMenuIcon from 'src/components/cardActionsMenu/cardActionsMenuIcon'

type Props = {
    board: Board
    card: Card
    onClick: (e: React.MouseEvent, card: Card) => void
    visiblePropertyTemplates: IPropertyTemplate[]
    visibleTitle: boolean
    isSelected: boolean
    visibleBadges: boolean
    readonly: boolean
    isManualSort: boolean
    onDrop: (srcCard: Card, dstCard: Card) => void
}

const GalleryCard = (props: Props) => {
    const intl = useIntl()
    const {card, board} = props
    const [isDragging, isOver, cardRef] = useSortable('card', card, props.isManualSort && !props.readonly, props.onDrop)
    const contents = useAppSelector(getCardContents(card.id))
    const [showConfirmationDialogBox, setShowConfirmationDialogBox] = useState<boolean>(false)

    const visiblePropertyTemplates = props.visiblePropertyTemplates || []

    const handleDeleteCard = useCallback(() => {
        mutator.deleteBlock(card, 'delete card')
    }, [card, board.id])

    const confirmDialogProps: ConfirmationDialogBoxProps = useMemo(() => {
        return {
            heading: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-heading', defaultMessage: 'Confirm card delete'}),
            confirmButtonText: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-button-text', defaultMessage: 'Delete'}),
            onConfirm: handleDeleteCard,
            onClose: () => {
                setShowConfirmationDialogBox(false)
            },
        }
    }, [handleDeleteCard])

    const image: ContentBlock|undefined = useMemo(() => {
        for (let i = 0; i < contents.length; ++i) {
            if (Array.isArray(contents[i])) {
                return (contents[i] as ContentBlock[]).find((c) => c.type === 'image')
            } else if ((contents[i] as ContentBlock).type === 'image') {
                return contents[i] as ContentBlock
            }
        }

        return undefined
    }, [contents])

    let className = props.isSelected ? 'GalleryCard selected' : 'GalleryCard'
    if (isOver) {
        className += ' dragover'
    }

    return (
        <>
            <div
                className={className}
                onClick={(e: React.MouseEvent) => props.onClick(e, card)}
                style={{opacity: isDragging ? 0.5 : 1}}
                ref={cardRef}
            >
                {!props.readonly &&
                    <MenuWrapper
                        className='optionsMenu'
                        stopPropagationOnToggle={true}
                    >
                        <CardActionsMenuIcon/>
                        <CardActionsMenu
                            cardId={card!.id}
                            boardId={card!.boardId}
                            onClickDelete={() => setShowConfirmationDialogBox(true)}
                            onClickDuplicate={() => {
                                TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DuplicateCard, {board: board.id, card: card.id})
                                mutator.duplicateCard(card.id, board.id)
                            }}
                        />
                    </MenuWrapper>
                }

                {image &&
                    <div className='gallery-image'>
                        <ImageElement block={image}/>
                    </div>}
                {!image &&
                    <CardDetailProvider card={card}>
                        <div className='gallery-item'>
                            {contents.map((block) => {
                                if (Array.isArray(block)) {
                                    return block.map((b) => (
                                        <ContentElement
                                            key={b.id}
                                            block={b}
                                            readonly={true}
                                            cords={{x: 0}}
                                        />
                                    ))
                                }

                                return (
                                    <ContentElement
                                        key={block.id}
                                        block={block}
                                        readonly={true}
                                        cords={{x: 0}}
                                    />
                                )
                            })}
                        </div>
                    </CardDetailProvider>}
                {props.visibleTitle &&
                    <div className='gallery-title'>
                        { card.fields.icon ? <div className='octo-icon'>{card.fields.icon}</div> : undefined }
                        <div
                            key='__title'
                            className='octo-titletext'
                        >
                            {card.title ||
                                <FormattedMessage
                                    id='KanbanCard.untitled'
                                    defaultMessage='Untitled'
                                />}
                        </div>
                    </div>}
                {visiblePropertyTemplates.length > 0 &&
                    <div className='gallery-props'>
                        {visiblePropertyTemplates.map((template) => (
                            <Tooltip
                                key={template.id}
                                title={template.name}
                                placement='top'
                            >
                                <PropertyValueElement
                                    board={board}
                                    readOnly={true}
                                    card={card}
                                    propertyTemplate={template}
                                    showEmptyPlaceholder={false}
                                />
                            </Tooltip>
                        ))}
                    </div>}
                {props.visibleBadges &&
                    <CardBadges
                        card={card}
                        className='gallery-badges'
                    />}
            </div>
            {showConfirmationDialogBox && <ConfirmationDialogBox dialogBox={confirmDialogProps}/>}
        </>
    )
}

export default React.memo(GalleryCard)
