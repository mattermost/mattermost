// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    createSlice,
    PayloadAction,
    createSelector,
    createAsyncThunk
} from '@reduxjs/toolkit'

import {Card} from 'src/blocks/card'
import {IUser} from 'src/user'
import {Board} from 'src/blocks/board'
import {Block} from 'src/blocks/block'
import {BoardView} from 'src/blocks/boardView'
import {CommentBlock} from 'src/blocks/commentBlock'
import {Utils} from 'src/utils'
import {Constants} from 'src/constants'
import {CardFilter} from 'src/cardFilter'
import {default as client} from 'src/octoClient'

import {loadBoardData, initialReadOnlyLoad, initialLoad} from './initialLoad'
import {getCurrentBoard} from './boards'
import {getBoardUsers} from './users'
import {getLastCommentByCard} from './comments'
import {getCurrentView} from './views'
import {getSearchText} from './searchText'

import {RootState} from './index'

type CardsState = {
    current: string
    limitTimestamp: number
    cards: {[key: string]: Card}
    templates: {[key: string]: Card}
    cardHiddenWarning: boolean
}

export const refreshCards = createAsyncThunk<Block[], number, {state: RootState}>(
    'refreshCards',
    async (cardLimitTimestamp: number, thunkAPI) => {
        const {cards} = thunkAPI.getState().cards
        const blocksPromises = []

        for (const card of Object.values(cards)) {
            if (card.limited && card.updateAt >= cardLimitTimestamp) {
                blocksPromises.push(client.getBlocksWithBlockID(card.id, card.boardId).then((blocks) => blocks.find((b) => b?.type === 'card')))
            }
        }
        const blocks = await Promise.all(blocksPromises)

        return blocks.filter((b: Block|undefined): boolean => Boolean(b)) as Block[]
    },
)

const limitCard = (isBoardTemplate: boolean, limitTimestamp: number, card: Card): Card => {
    if (isBoardTemplate) {
        return card
    }
    if (card.updateAt >= limitTimestamp) {
        return card
    }
    return {
        ...card,
        fields: {
            icon: card.fields.icon,
            properties: {},
            contentOrder: [],
        },
        limited: true,
    }
}

const cardsSlice = createSlice({
    name: 'cards',
    initialState: {
        current: '',
        limitTimestamp: 0,
        cards: {},
        templates: {},
        cardHiddenWarning: false,
    } as CardsState,
    reducers: {
        setCurrent: (state, action: PayloadAction<string>) => {
            state.current = action.payload
        },
        setLimitTimestamp: (state, action: PayloadAction<{timestamp: number, templates: {[key: string]: Board}}>) => {
            state.limitTimestamp = action.payload.timestamp
            for (const card of Object.values(state.cards)) {
                state.cards[card.id] = limitCard(Boolean(action.payload.templates[card.id]), state.limitTimestamp, card)
            }
        },
        addCard: (state, action: PayloadAction<Card>) => {
            state.cards[action.payload.id] = action.payload
        },
        showCardHiddenWarning: (state, action: PayloadAction<boolean>) => {
            state.cardHiddenWarning = action.payload
        },
        addTemplate: (state: CardsState, action: PayloadAction<Card>) => {
            state.templates[action.payload.id] = action.payload
        },
        updateCards: (state: CardsState, action: PayloadAction<Card[]>) => {
            for (const card of action.payload) {
                if (card.deleteAt !== 0) {
                    delete state.cards[card.id]
                    delete state.templates[card.id]
                } else if (card.fields.isTemplate) {
                    state.templates[card.id] = card
                } else {
                    state.cards[card.id] = card
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(refreshCards.fulfilled, (state, action) => {
            for (const block of action.payload) {
                state.cards[block.id] = block as Card
            }
        })
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.cards = {}
            state.templates = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'card' && block.fields.isTemplate) {
                    state.templates[block.id] = block as Card
                } else if (block.type === 'card' && !block.fields.isTemplate) {
                    state.cards[block.id] = block as Card
                }
            }
        })
        builder.addCase(initialLoad.fulfilled, (state, action) => {
            state.limitTimestamp = action.payload.limits?.card_limit_timestamp || 0
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.cards = {}
            state.templates = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'card' && block.fields.isTemplate) {
                    state.templates[block.id] = block as Card
                } else if (block.type === 'card' && !block.fields.isTemplate) {
                    state.cards[block.id] = block as Card
                }
            }
        })
    },
})

export const {updateCards, addCard, addTemplate, setCurrent, setLimitTimestamp, showCardHiddenWarning} = cardsSlice.actions
export const {reducer} = cardsSlice

export const getCards = (state: RootState): {[key: string]: Card} => state.cards.cards

export const getSortedCards = createSelector(
    getCards,
    (cards) => {
        return Object.values(cards).sort((a, b) => a.title.localeCompare(b.title)) as Card[]
    },
)

export const getTemplates = (state: RootState): {[key: string]: Card} => state.cards.templates

export const getSortedTemplates = createSelector(
    getTemplates,
    (templates) => {
        return Object.values(templates).sort((a, b) => a.title.localeCompare(b.title)) as Card[]
    },
)

export function getCard(cardId: string): (state: RootState) => Card|undefined {
    return (state: RootState): Card|undefined => {
        return getCards(state)[cardId] || getTemplates(state)[cardId]
    }
}

export const getCurrentBoardCards = createSelector(
    (state: RootState) => state.boards.current,
    getCards,
    (boardId, cards) => {
        return Object.values(cards).filter((c) => c.boardId === boardId) as Card[]
    },
)

export const getCurrentBoardTemplates = createSelector(
    (state: RootState) => state.boards.current,
    getTemplates,
    (boardId, templates) => {
        return Object.values(templates).filter((c) => c.boardId === boardId) as Card[]
    },
)

function titleOrCreatedOrder(cardA: Card, cardB: Card) {
    const aValue = cardA.title
    const bValue = cardB.title

    if (aValue && bValue) {
        return aValue.localeCompare(bValue)
    }

    // Always put untitled cards at the bottom
    if (aValue && !bValue) {
        return -1
    }
    if (bValue && !aValue) {
        return 1
    }

    // If both cards are untitled, use the create date
    return cardA.createAt - cardB.createAt
}

function manualOrder(activeView: BoardView, cardA: Card, cardB: Card) {
    const indexA = activeView.fields.cardOrder.indexOf(cardA.id)
    const indexB = activeView.fields.cardOrder.indexOf(cardB.id)

    if (indexA < 0 && indexB < 0) {
        return titleOrCreatedOrder(cardA, cardB)
    } else if (indexA < 0 && indexB >= 0) {
        // If cardA's order is not defined, put it at the end
        return 1
    }
    return indexA - indexB
}

function sortCards(cards: Card[], lastCommentByCard: {[key: string]: CommentBlock}, board: Board, activeView: BoardView, usersById: {[key: string]: IUser}): Card[] {
    if (!activeView) {
        return cards
    }
    const {sortOptions} = activeView.fields

    if (sortOptions.length < 1) {
        Utils.log('Manual sort')
        return cards.sort((a, b) => manualOrder(activeView, a, b))
    }

    let sortedCards = cards
    for (const sortOption of sortOptions) {
        if (sortOption.propertyId === Constants.titleColumnId) {
            Utils.log('Sort by title')
            sortedCards = sortedCards.sort((a, b) => {
                const result = titleOrCreatedOrder(a, b)
                return sortOption.reversed ? -result : result
            })
        } else {
            const sortPropertyId = sortOption.propertyId
            const template = board.cardProperties.find((o) => o.id === sortPropertyId)
            if (!template) {
                Utils.logError(`Missing template for property id: ${sortPropertyId}`)
                return sortedCards
            }
            Utils.log(`Sort by property: ${template?.name}`)
            sortedCards = sortedCards.sort((a, b) => {
                // Always put cards with no titles at the bottom, regardless of sort
                let aValue = a.fields.properties[sortPropertyId] || ''
                let bValue = b.fields.properties[sortPropertyId] || ''

                if (template.type === 'createdBy') {
                    aValue = usersById[a.createdBy]?.username || ''
                    bValue = usersById[b.createdBy]?.username || ''
                } else if (template.type === 'updatedBy') {
                    aValue = usersById[a.modifiedBy]?.username || ''
                    bValue = usersById[b.modifiedBy]?.username || ''
                } else if (template.type === 'date') {
                    aValue = (aValue === '') ? '' : JSON.parse(aValue as string).from
                    bValue = (bValue === '') ? '' : JSON.parse(bValue as string).from
                }

                let result = 0
                if (template.type === 'number' || template.type === 'date') {
                    // Always put empty values at the bottom
                    if (aValue && !bValue) {
                        return -1
                    }
                    if (bValue && !aValue) {
                        return 1
                    }
                    if (!aValue && !bValue) {
                        return titleOrCreatedOrder(a, b)
                    }

                    result = Number(aValue) - Number(bValue)
                } else if (template.type === 'createdTime') {
                    result = a.createAt - b.createAt
                } else if (template.type === 'updatedTime') {
                    const aUpdateAt = Math.max(a.updateAt, lastCommentByCard[a.id]?.updateAt || 0)
                    const bUpdateAt = Math.max(b.updateAt, lastCommentByCard[b.id]?.updateAt || 0)
                    result = aUpdateAt - bUpdateAt
                } else {
                    // Text-based sort

                    if (aValue.length > 0 && bValue.length <= 0) {
                        return -1
                    }
                    if (bValue.length > 0 && aValue.length <= 0) {
                        return 1
                    }
                    if (aValue.length <= 0 && bValue.length <= 0) {
                        return titleOrCreatedOrder(a, b)
                    }

                    if (template.type === 'select' || template.type === 'multiSelect') {
                        aValue = template.options.find((o) => o.id === (Array.isArray(aValue) ? aValue[0] : aValue))?.value || ''
                        bValue = template.options.find((o) => o.id === (Array.isArray(bValue) ? bValue[0] : bValue))?.value || ''
                    }

                    if (template.type === 'multiPerson') {
                        aValue = Array.isArray(aValue) && aValue.length !== 0 && Object.keys(usersById).length > 0 ? aValue.map((id) => {
                            if (usersById[id] !== undefined) {
                                return usersById[id].username
                            }
                            return ''
                        }).toString() : aValue

                        bValue = Array.isArray(bValue) && bValue.length !== 0 && Object.keys(usersById).length > 0 ? bValue.map((id) => {
                            if (usersById[id] !== undefined) {
                                return usersById[id].username
                            }
                            return ''
                        }).toString() : bValue
                    }

                    result = (aValue as string).localeCompare(bValue as string)
                }

                if (result === 0) {
                    // In case of "ties", use the title order
                    result = titleOrCreatedOrder(a, b)
                }

                return sortOption.reversed ? -result : result
            })
        }
    }

    return sortedCards
}

function searchFilterCards(cards: Card[], board: Board, searchTextRaw: string): Card[] {
    const searchText = searchTextRaw.toLocaleLowerCase()
    if (!searchText) {
        return cards.slice()
    }

    return cards.filter((card: Card) => {
        const searchTextInCardTitle: boolean = card.title?.toLocaleLowerCase().includes(searchText)
        if (searchTextInCardTitle) {
            return true
        }

        for (const [propertyId, propertyValue] of Object.entries(card.fields.properties)) {
            // TODO: Refactor to a shared function that returns the display value of a property
            const propertyTemplate = board.cardProperties.find((o) => o.id === propertyId)
            if (propertyTemplate && propertyValue) {
                if (propertyTemplate.type === 'select') {
                    // Look up the value of the select option
                    const option = propertyTemplate.options.find((o) => o.id === propertyValue)
                    if (option?.value.toLowerCase().includes(searchText)) {
                        return true
                    }
                } else if (propertyTemplate.type === 'multiSelect') {
                    // Look up the value of the select option
                    const options = (Array.isArray(propertyValue) ? propertyValue : [propertyValue]).map((value) => propertyTemplate.options.find((o) => o.id === value)?.value.toLowerCase())
                    if (options?.includes(searchText)) {
                        return true
                    }
                } else if (propertyTemplate.type !== 'date' && (propertyValue.toString()).toLowerCase().includes(searchText)) {
                    return true
                }
            }
        }

        return false
    })
}

export const getCurrentViewCardsSortedFilteredAndGroupedWithoutLimit = createSelector(
    getCurrentBoardCards,
    getLastCommentByCard,
    getCurrentBoard,
    getCurrentView,
    getSearchText,
    getBoardUsers,
    (cards, lastCommentByCard, board, view, searchText, users) => {
        if (!view || !board || !users || !cards) {
            return []
        }
        let result = cards.filter((c) => !c.limited)
        if (view.fields.filter) {
            result = CardFilter.applyFilterGroup(view.fields.filter, board.cardProperties, result)
        }

        if (searchText) {
            result = searchFilterCards(result, board, searchText)
        }
        result = sortCards(result, lastCommentByCard, board, view, users)
        return result
    },
)

export const getCurrentViewCardsSortedFilteredAndGrouped = createSelector(
    getCurrentViewCardsSortedFilteredAndGroupedWithoutLimit,
    (cards) => cards.filter((c) => !c.limited),
)

export const getCurrentBoardHiddenCardsCount = createSelector(
    getCurrentBoardCards,
    (cards) => Object.values(cards).filter((c) => c.limited).length,
)

export const getCurrentCard = createSelector(
    (state: RootState) => state.cards.current,
    getCards,
    (current, cards) => cards[current],
)

export const getCardLimitTimestamp = (state: RootState): number => state.cards.limitTimestamp
export const getCardHiddenWarning = (state: RootState): boolean => state.cards.cardHiddenWarning
