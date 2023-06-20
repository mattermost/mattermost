// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'
import {useIntl} from 'react-intl'

import {Card} from 'src/blocks/card'
import {ContentBlock as ContentBlockType, IContentBlockWithCords} from 'src/blocks/contentBlock'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import IconButton from 'src/widgets/buttons/iconButton'
import AddIcon from 'src/widgets/icons/add'
import DeleteIcon from 'src/widgets/icons/delete'
import OptionsIcon from 'src/widgets/icons/options'
import SortDownIcon from 'src/widgets/icons/sortDown'
import SortUpIcon from 'src/widgets/icons/sortUp'
import GripIcon from 'src/widgets/icons/grip'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import {useSortableWithGrip} from 'src/hooks/sortable'
import {Position} from 'src/components/cardDetail/cardDetailContents'

import ContentElement from './content/contentElement'
import AddContentMenuItem from './addContentMenuItem'
import {contentRegistry} from './content/contentRegistry'

import './contentBlock.scss'

type Props = {
    block: ContentBlockType
    card: Card
    readonly: boolean
    onDrop: (srctBlock: IContentBlockWithCords, dstBlock: IContentBlockWithCords, position: Position) => void
    width?: number
    cords: {x: number, y?: number, z?: number}
}

const ContentBlock = (props: Props): JSX.Element => {
    const {card, block, readonly, cords} = props
    const intl = useIntl()
    const [, , gripRef, itemRef] = useSortableWithGrip('content', {block, cords}, true, () => {})
    const [, isOver2,, itemRef2] = useSortableWithGrip('content', {block, cords}, true, (src, dst) => props.onDrop(src, dst, 'right'))
    const [, isOver3,, itemRef3] = useSortableWithGrip('content', {block, cords}, true, (src, dst) => props.onDrop(src, dst, 'left'))
    const [menuOpened, setMenuOpened] = useState(false)

    const index = cords.x
    const colIndex = (cords.y || cords.y === 0) && cords.y > -1 ? cords.y : -1
    const contentOrder: Array<string|string[]> = []
    if (card.fields.contentOrder) {
        for (const contentId of card.fields.contentOrder) {
            if (typeof contentId === 'string') {
                contentOrder.push(contentId)
            } else {
                contentOrder.push(contentId.slice())
            }
        }
    }

    let className = 'ContentBlock octo-block'
    if (menuOpened) {
        className += ' menuOpened'
    }

    return (
        <div
            className='rowContents'
            style={{width: props.width + '%'}}
        >
            <div
                ref={itemRef}
                className={className}
            >
                <div className='octo-block-margin'>
                    {!props.readonly &&
                    <MenuWrapper onToggle={setMenuOpened}>
                        <IconButton icon={<OptionsIcon/>}/>
                        <Menu>
                            {index > 0 &&
                                <Menu.Text
                                    id='moveUp'
                                    name={intl.formatMessage({id: 'ContentBlock.moveUp', defaultMessage: 'Move up'})}
                                    icon={<SortUpIcon/>}
                                    onClick={() => {
                                        Utils.arrayMove(contentOrder, index, index - 1)
                                        mutator.changeCardContentOrder(props.card.boardId, card.id, card.fields.contentOrder, contentOrder)
                                    }}
                                />}
                            {index < (contentOrder.length - 1) &&
                                <Menu.Text
                                    id='moveDown'
                                    name={intl.formatMessage({id: 'ContentBlock.moveDown', defaultMessage: 'Move down'})}
                                    icon={<SortDownIcon/>}
                                    onClick={() => {
                                        Utils.arrayMove(contentOrder, index, index + 1)
                                        mutator.changeCardContentOrder(props.card.boardId, card.id, card.fields.contentOrder, contentOrder)
                                    }}
                                />}
                            <Menu.SubMenu
                                id='insertAbove'
                                name={intl.formatMessage({id: 'ContentBlock.insertAbove', defaultMessage: 'Insert above'})}
                                icon={<AddIcon/>}
                                position='top'
                            >
                                {contentRegistry.contentTypes.map((type) => (
                                    <AddContentMenuItem
                                        key={type}
                                        type={type}
                                        card={card}
                                        cords={cords}
                                    />
                                ))}
                            </Menu.SubMenu>
                            <Menu.Text
                                icon={<DeleteIcon/>}
                                id='delete'
                                name={intl.formatMessage({id: 'ContentBlock.Delete', defaultMessage: 'Delete'})}
                                onClick={() => {
                                    const description = intl.formatMessage({id: 'ContentBlock.DeleteAction', defaultMessage: 'delete'})

                                    if (colIndex > -1) {
                                        (contentOrder[index] as string[]).splice(colIndex, 1)
                                    } else {
                                        contentOrder.splice(index, 1)
                                    }

                                    // If only one item in the row, convert form an array item to normal item ( [item] => item )
                                    if (Array.isArray(contentOrder[index]) && contentOrder[index].length === 1) {
                                        contentOrder[index] = contentOrder[index][0]
                                    }

                                    mutator.performAsUndoGroup(async () => {
                                        await mutator.deleteBlock(block, description)
                                        await mutator.changeCardContentOrder(props.card.boardId, card.id, card.fields.contentOrder, contentOrder, description)
                                    })
                                }}
                            />
                        </Menu>
                    </MenuWrapper>
                    }
                    {!props.readonly &&
                        <div
                            ref={gripRef}
                            className='dnd-handle'
                        >
                            <GripIcon/>
                        </div>
                    }
                </div>
                {!cords.y /* That is to say if cords.y === 0 or cords.y === undefined */ &&
                    <div
                        ref={itemRef3}
                        className={`addToRow ${isOver3 ? 'dragover' : ''}`}
                        style={{flex: 'none', height: '100%'}}
                    />
                }
                <ContentElement
                    block={block}
                    readonly={readonly}
                    cords={cords}
                />
            </div>
            <div
                ref={itemRef2}
                className={`addToRow ${isOver2 ? 'dragover' : ''}`}
            />
        </div>
    )
}

export default React.memo(ContentBlock)
