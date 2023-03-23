// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Board,
    IPropertyOption,
    IPropertyTemplate,
    createBoard
} from 'src/blocks/board'
import {BoardView, createBoardView} from 'src/blocks/boardView'
import {Card, createCard} from 'src/blocks/card'
import {CommentBlock, createCommentBlock} from 'src/blocks/commentBlock'
import {DividerBlock, createDividerBlock} from 'src/blocks/dividerBlock'
import {createFilterClause} from 'src/blocks/filterClause'
import {createFilterGroup} from 'src/blocks/filterGroup'
import {ImageBlock, createImageBlock} from 'src/blocks/imageBlock'
import {TextBlock, createTextBlock} from 'src/blocks/textBlock'
import {Category, CategoryBoards} from 'src/store/sidebar'
import {Utils} from 'src/utils'
import {CheckboxBlock, createCheckboxBlock} from 'src/blocks/checkboxBlock'
import {Block} from 'src/blocks/block'
import {IUser} from 'src/user'

class TestBlockFactory {
    static createBoard(): Board {
        const board = createBoard()
        board.title = 'board title'
        board.description = 'description'
        board.showDescription = true
        board.icon = 'i'

        for (let i = 0; i < 3; i++) {
            const propertyOption: IPropertyOption = {
                id: 'value1',
                value: 'value 1',
                color: 'propColorBrown',
            }
            const propertyTemplate: IPropertyTemplate = {
                id: `property${i + 1}`,
                name: `Property ${i + 1}`,
                type: 'select',
                options: [propertyOption],
            }
            board.cardProperties.push(propertyTemplate)
        }

        return board
    }

    static createBoardView(board?: Board): BoardView {
        const view = createBoardView()
        view.boardId = board ? board.id : 'board'
        view.title = 'view title'
        view.fields.viewType = 'board'
        view.fields.groupById = 'property1'
        view.fields.hiddenOptionIds = ['value1']
        view.fields.cardOrder = ['card1', 'card2', 'card3']
        view.fields.sortOptions = [
            {
                propertyId: 'property1',
                reversed: true,
            },
            {
                propertyId: 'property2',
                reversed: false,
            },
        ]
        view.fields.columnWidths = {
            column1: 100,
            column2: 200,
        }

        // Filter
        const filterGroup = createFilterGroup()
        const filter = createFilterClause()
        filter.propertyId = 'property1'
        filter.condition = 'includes'
        filter.values = ['value1']
        filterGroup.filters.push(filter)
        view.fields.filter = filterGroup

        return view
    }

    static createTableView(board?: Board): BoardView {
        const view = createBoardView()
        view.boardId = board ? board.id : 'board'
        view.title = 'view title'
        view.fields.viewType = 'table'
        view.fields.groupById = 'property1'
        view.fields.hiddenOptionIds = ['value1']
        view.fields.cardOrder = ['card1', 'card2', 'card3']
        view.fields.sortOptions = [
            {
                propertyId: 'property1',
                reversed: true,
            },
            {
                propertyId: 'property2',
                reversed: false,
            },
        ]
        view.fields.columnWidths = {
            column1: 100,
            column2: 200,
        }

        // Filter
        const filterGroup = createFilterGroup()
        const filter = createFilterClause()
        filter.propertyId = 'property1'
        filter.condition = 'includes'
        filter.values = ['value1']
        filterGroup.filters.push(filter)
        view.fields.filter = filterGroup

        return view
    }

    static createCard(board?: Board): Card {
        const card = createCard()
        card.boardId = board ? board.id : 'board'
        card.title = 'title'
        card.fields.icon = 'i'
        card.fields.properties.property1 = 'value1'
        return card
    }

    private static addToCard<BlockType extends Block>(block: BlockType, card: Card, isContent = true): BlockType {
        block.parentId = card.id
        block.boardId = card.boardId
        if (isContent) {
            card.fields.contentOrder.push(block.id)
        }
        return block
    }

    static createComment(card: Card): CommentBlock {
        const block = this.addToCard(createCommentBlock(), card, false)
        block.title = 'title'

        return block
    }

    static createText(card: Card): TextBlock {
        const block = this.addToCard(createTextBlock(), card)
        block.title = 'title'
        return block
    }

    static createImage(card: Card): ImageBlock {
        const block = this.addToCard(createImageBlock(), card)
        block.fields.fileId = 'fileId'
        return block
    }

    static createDivider(card: Card): DividerBlock {
        const block = this.addToCard(createDividerBlock(), card)
        block.title = 'title'
        return block
    }

    static createCheckbox(card: Card): CheckboxBlock {
        const block = this.addToCard(createCheckboxBlock(), card)
        block.title = 'title'
        return block
    }

    static createCategory(): Category {
        const now = Date.now()

        return {
            id: Utils.createGuid(Utils.blockTypeToIDType('7')),
            name: 'Category',
            createAt: now,
            updateAt: now,
            deleteAt: 0,
            userID: '',
            teamID: '',
            collapsed: false,
            type: 'custom',
            sortOrder: 0,
            isNew: false,
        }
    }

    static createCategoryBoards(): CategoryBoards {
        return {
            ...TestBlockFactory.createCategory(),
            boardMetadata: [],
        }
    }

    static createUser(): IUser {
        return {
            id: 'user-id-1',
            username: 'Dwight Schrute',
            email: 'dwight.schrute@dundermifflin.com',
            nickname: '',
            firstname: '',
            lastname: '',
            props: {},
            create_at: Date.now(),
            update_at: Date.now(),
            is_bot: false,
            is_guest: false,
            roles: 'system_user',
        }
    }
}

export {TestBlockFactory}
