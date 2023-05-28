// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import {useIntl} from 'react-intl'
import {useHotkeys} from 'react-hotkeys-hook'

import {ClientConfig} from 'src/config/clientConfig'

import {Block} from 'src/blocks/block'
import {BlockIcons} from 'src/blockIcons'
import {Card, createCard} from 'src/blocks/card'
import {Board, BoardGroup, IPropertyTemplate} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import {CardFilter} from 'src/cardFilter'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import {UserSettings} from 'src/userSettings'
import {
    addCard as addCardAction,
    addTemplate as addTemplateAction,
    getCurrentCard,
    showCardHiddenWarning,
} from 'src/store/cards'
import {getCardLimitTimestamp} from 'src/store/limits'
import {updateView} from 'src/store/views'
import {getVisibleAndHiddenGroups} from 'src/boardUtils'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import {getClientConfig} from 'src/store/clientConfig'

import './centerPanel.scss'

import {useAppDispatch, useAppSelector} from 'src/store/hooks'

import {
    getBoardUsers,
    getMe,
    getOnboardingTourCategory,
    getOnboardingTourStarted,
    getOnboardingTourStep,
    patchProps,
} from 'src/store/users'

import {UserConfigPatch} from 'src/user'

import octoClient from 'src/octoClient'

import ShareBoardButton from './shareBoard/shareBoardButton'
import ShareBoardLoginButton from './shareBoard/shareBoardLoginButton'

import CardDialog from './cardDialog'
import RootPortal from './rootPortal'
import TopBar from './topBar'
import ViewHeader from './viewHeader/viewHeader'
import ViewTitle from './viewTitle'
import Kanban from './kanban/kanban'

import Table from './table/table'

import CalendarFullView from './calendar/fullCalendar'

import CardLimitNotification from './cardLimitNotification'

import Gallery from './gallery/gallery'
import {
    BoardTourSteps,
    FINISHED,
    TOUR_BOARD,
    TOUR_CARD,
} from './onboardingTour'
import ShareBoardTourStep from './onboardingTour/shareBoard/shareBoard'

type Props = {
    clientConfig?: ClientConfig
    board: Board
    cards: Card[]
    activeView: BoardView
    views: BoardView[]
    groupByProperty?: IPropertyTemplate
    dateDisplayProperty?: IPropertyTemplate
    readonly: boolean
    shownCardId?: string
    showCard: (cardId?: string) => void
    hiddenCardsCount: number
}

const CenterPanel = (props: Props) => {
    const intl = useIntl()
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
    const [cardIdToFocusOnRender, setCardIdToFocusOnRender] = useState('')
    const [showHiddenCardCountNotification, setShowHiddenCardCountNotification] = useState(false)

    const onboardingTourStarted = useAppSelector(getOnboardingTourStarted)
    const onboardingTourCategory = useAppSelector(getOnboardingTourCategory)
    const onboardingTourStep = useAppSelector(getOnboardingTourStep)
    const cardLimitTimestamp = useAppSelector(getCardLimitTimestamp)
    const me = useAppSelector(getMe)
    const currentCard = useAppSelector(getCurrentCard)
    const boardUsers = useAppSelector(getBoardUsers)
    const dispatch = useAppDispatch()

    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)

    // empty dependency array yields behavior like `componentDidMount`, it only runs _once_
    // https://stackoverflow.com/a/58579462
    useEffect(() => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ViewBoard, {board: props.board.id, view: props.activeView.id, viewType: props.activeView.fields.viewType})
    }, [])

    useHotkeys('esc', (e: KeyboardEvent) => {
        if (e.target !== document.body || props.readonly) {
            return
        }
        if (selectedCardIds.length > 0) {
            setSelectedCardIds([])
            e.stopPropagation()
        }
    }, [selectedCardIds, props.readonly])

    useHotkeys('ctrl+d', (e: KeyboardEvent) => {
        if (e.target !== document.body || props.readonly) {
            return
        }

        if (selectedCardIds.length > 0) {
            // CTRL+D: Duplicate selected cards
            const {board} = props
            if (selectedCardIds.length < 1) {
                return
            }

            mutator.performAsUndoGroup(async () => {
                for (const cardId of selectedCardIds) {
                    const card = props.cards.find((o) => o.id === cardId)
                    if (card) {
                        mutator.duplicateCard(cardId, board.id)
                    } else {
                        Utils.assertFailure(`Selected card not found: ${cardId}`)
                    }
                }
            })

            setSelectedCardIds([])
            e.stopPropagation()
            e.preventDefault()
        }
    }, [selectedCardIds, props.readonly, props.cards, props.board.id])

    useHotkeys('del,backspace', (e: KeyboardEvent) => {
        if (e.target !== document.body || props.readonly) {
            return
        }

        if (selectedCardIds.length > 0) {
            // Backspace or Del: Delete selected cards
            if (selectedCardIds.length < 1) {
                return
            }

            mutator.performAsUndoGroup(async () => {
                for (const cardId of selectedCardIds) {
                    const card = props.cards.find((o) => o.id === cardId)
                    if (card) {
                        mutator.deleteBlock(card, selectedCardIds.length > 1 ? `delete ${selectedCardIds.length} cards` : 'delete card')
                    } else {
                        Utils.assertFailure(`Selected card not found: ${cardId}`)
                    }
                }
            })

            setSelectedCardIds([])
            e.stopPropagation()
        }
    }, [selectedCardIds, props.readonly, props.cards])

    const showCard = useCallback((cardId?: string) => {
        if (selectedCardIds.length > 0) {
            setSelectedCardIds([])
        }
        props.showCard(cardId)
    }, [props.showCard, selectedCardIds])

    const addCard = useCallback(async (groupByOptionId?: string, show = false, properties: Record<string, string> = {}): Promise<void> => {
        const {activeView, board, groupByProperty} = props

        const card = createCard()

        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateCard, {board: board.id, view: activeView.id, card: card.id})

        card.parentId = board.id
        card.boardId = board.id
        const propertiesThatMeetFilters = CardFilter.propertiesThatMeetFilterGroup(activeView.fields.filter, board.cardProperties)
        if ((activeView.fields.viewType === 'board' || activeView.fields.viewType === 'table') && groupByProperty) {
            if (groupByOptionId) {
                propertiesThatMeetFilters[groupByProperty.id] = groupByOptionId
            } else {
                delete propertiesThatMeetFilters[groupByProperty.id]
            }
        }
        card.fields.properties = {...card.fields.properties, ...properties, ...propertiesThatMeetFilters}
        if (!card.fields.icon && UserSettings.prefillRandomIcons) {
            card.fields.icon = BlockIcons.shared.randomIcon()
        }
        mutator.performAsUndoGroup(async () => {
            const newCard = await mutator.insertBlock(
                card.boardId,
                card,
                'add card',
                async (block: Block) => {
                    if (show) {
                        dispatch(addCardAction(createCard(block)))
                        dispatch(updateView({...activeView, fields: {...activeView.fields, cardOrder: [...activeView.fields.cardOrder, block.id]}}))
                        showCard(block.id)
                    } else {
                        // Focus on this card's title inline on next render
                        setCardIdToFocusOnRender(block.id)
                        setTimeout(() => setCardIdToFocusOnRender(''), 300)
                    }
                },
                async () => {
                    showCard(undefined)
                },
            )
            dispatch(showCardHiddenWarning(cardLimitTimestamp > 0))
            await mutator.changeViewCardOrder(board.id, activeView.id, activeView.fields.cardOrder, [...activeView.fields.cardOrder, newCard.id], 'add-card')
        })
    }, [props.activeView, props.board.id, props.board.cardProperties, props.groupByProperty, showCard])

    const addEmptyCardAndShow = useCallback(() => addCard('', true), [addCard])

    const shouldStartBoardsTour = useCallback((): boolean => {
        const isOnboardingBoard = props.board.title === 'Welcome to Boards!'
        const isTourStarted = onboardingTourStarted
        const completedCardsTour = onboardingTourCategory === TOUR_CARD && onboardingTourStep === FINISHED.toString()
        const noCardOpen = !currentCard

        return isOnboardingBoard && isTourStarted && completedCardsTour && noCardOpen
    }, [currentCard, onboardingTourStarted, onboardingTourCategory, onboardingTourStep, props.board.title])

    const prepareBoardsTour = useCallback(async () => {
        if (!me?.id) {
            return
        }

        const patch: UserConfigPatch = {
            updatedFields: {
                tourCategory: TOUR_BOARD,
                onboardingTourStep: BoardTourSteps.ADD_VIEW.toString(),
            },
        }

        const patchedProps = await octoClient.patchUserConfig(me.id, patch)
        if (patchedProps) {
            await dispatch(patchProps(patchedProps))
        }
    }, [me?.id])

    const startBoardsTour = useCallback(async () => {
        if (!shouldStartBoardsTour()) {
            return
        }

        await prepareBoardsTour()
    }, [prepareBoardsTour, shouldStartBoardsTour])

    useEffect(() => {
        startBoardsTour()
    })

    const backgroundClicked = useCallback((e: React.MouseEvent) => {
        if (selectedCardIds.length > 0) {
            setSelectedCardIds([])
            e.stopPropagation()
        }
    }, [selectedCardIds])

    const addCardFromTemplate = useCallback(async (cardTemplateId: string, groupByOptionId?: string) => {
        const {activeView, board, groupByProperty} = props

        const propertiesThatMeetFilters = CardFilter.propertiesThatMeetFilterGroup(activeView.fields.filter, board.cardProperties)
        if ((activeView.fields.viewType === 'board' || activeView.fields.viewType === 'table') && groupByProperty) {
            if (groupByOptionId) {
                propertiesThatMeetFilters[groupByProperty.id] = groupByOptionId
            } else {
                delete propertiesThatMeetFilters[groupByProperty.id]
            }
        }

        mutator.performAsUndoGroup(async () => {
            const [, newCardId] = await mutator.duplicateCard(
                cardTemplateId,
                board.id,
                true,
                intl.formatMessage({id: 'Mutator.new-card-from-template', defaultMessage: 'new card from template'}),
                false,
                propertiesThatMeetFilters,
                async (cardId) => {
                    dispatch(updateView({...activeView, fields: {...activeView.fields, cardOrder: [...activeView.fields.cardOrder, cardId]}}))
                    TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateCardViaTemplate, {board: props.board.id, view: props.activeView.id, card: cardId, cardTemplateId})
                    showCard(cardId)
                },
                async () => {
                    showCard(undefined)
                },
            )
            await mutator.changeViewCardOrder(props.board.id, activeView.id, activeView.fields.cardOrder, [...activeView.fields.cardOrder, newCardId], 'add-card')
        })
    }, [props.board, props.activeView, showCard])

    const addCardTemplate = useCallback(async () => {
        const {board, activeView} = props

        const cardTemplate = createCard()
        cardTemplate.fields.isTemplate = true
        cardTemplate.parentId = board.id
        cardTemplate.boardId = board.id

        await mutator.insertBlock(
            cardTemplate.boardId,
            cardTemplate,
            'add card template',
            async (newBlock: Block) => {
                const newTemplate = createCard(newBlock)
                TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateCardTemplate, {board: board.id, view: activeView.id, card: newTemplate.id})
                dispatch(addTemplateAction(newTemplate))
                showCard(newTemplate.id)
            }, async () => {
                showCard(undefined)
            },
        )
    }, [props.board, props.activeView, showCard])

    const editCardTemplate = useCallback((cardTemplateId: string) => {
        showCard(cardTemplateId)
    }, [showCard])

    const cardClicked = useCallback((e: React.MouseEvent, card: Card): void => {
        const {activeView, cards} = props

        if (e.shiftKey) {
            let newSelectedCardIds = [...selectedCardIds]
            if (newSelectedCardIds.length > 0 && (e.metaKey || e.ctrlKey)) {
                // Cmd+Shift+Click: Extend the selection
                const orderedCardIds = cards.map((o) => o.id)
                const lastCardId = newSelectedCardIds[newSelectedCardIds.length - 1]
                const srcIndex = orderedCardIds.indexOf(lastCardId)
                const destIndex = orderedCardIds.indexOf(card.id)
                const newCardIds = (srcIndex < destIndex) ? orderedCardIds.slice(srcIndex, destIndex + 1) : orderedCardIds.slice(destIndex, srcIndex + 1)
                for (const newCardId of newCardIds) {
                    if (!newSelectedCardIds.includes(newCardId)) {
                        newSelectedCardIds.push(newCardId)
                    }
                }
                setSelectedCardIds(newSelectedCardIds)
            } else {
                // Shift+Click: add to selection
                if (newSelectedCardIds.includes(card.id)) {
                    newSelectedCardIds = selectedCardIds.filter((o) => o !== card.id)
                } else {
                    newSelectedCardIds.push(card.id)
                }
                setSelectedCardIds(newSelectedCardIds)
            }
        } else if (activeView.fields.viewType === 'board' || activeView.fields.viewType === 'gallery') {
            showCard(card.id)
        }

        e.stopPropagation()
    }, [selectedCardIds, props.activeView, props.cards, showCard])

    const hiddenCardCountNotifyHandler = useCallback((show: boolean) => {
        setShowHiddenCardCountNotification(show)
    }, [showHiddenCardCountNotification])

    const showShareButton = !props.readonly && me?.id !== 'single-user'
    const showShareLoginButton = props.readonly && me?.id !== 'single-user'

    const {groupByProperty, activeView, board, views, cards} = props

    const getUserDisplayName = (boardGroup: BoardGroup) => {
        const user = boardUsers[boardGroup.option.id]
        if (user) {
            return Utils.getUserDisplayName(user, clientConfig.teammateNameDisplay)
        } else if (boardGroup.option.id === 'undefined') {
            return intl.formatMessage({
                id: 'centerPanel.undefined',
                defaultMessage: 'No {propertyName}',
            }, {propertyName: groupByProperty?.name})
        }

        return intl.formatMessage({id: 'centerPanel.unknown-user', defaultMessage: 'Unknown user'})
    }

    const {visible: visibleGroups, hidden: hiddenGroups} = useMemo(() => {
        const {visible: vg, hidden: hg} = getVisibleAndHiddenGroups(cards, activeView.fields.visibleOptionIds, activeView.fields.hiddenOptionIds, groupByProperty)
        if (groupByProperty?.type === 'createdBy' || groupByProperty?.type === 'updatedBy' || groupByProperty?.type === 'person') {
            if (boardUsers) {
                vg.forEach((value) => {
                    value.option.value = getUserDisplayName(value)
                })
                hg.forEach((value) => {
                    value.option.value = getUserDisplayName(value)
                })
            }
        }

        return {visible: vg, hidden: hg}
    }, [cards, activeView.fields.visibleOptionIds, activeView.fields.hiddenOptionIds, groupByProperty, boardUsers])

    return (
        <div
            className='BoardComponent'
            onClick={backgroundClicked}
        >
            {props.shownCardId &&
                <RootPortal>
                    <CardDialog
                        board={board}
                        activeView={activeView}
                        views={views}
                        cards={cards}
                        key={props.shownCardId}
                        cardId={props.shownCardId}
                        onClose={() => showCard(undefined)}
                        showCard={(cardId) => showCard(cardId)}
                        readonly={props.readonly}
                    />
                </RootPortal>}

            <div className='top-head'>
                <TopBar/>
                <div className='mid-head'>
                    <ViewTitle
                        key={board.id + board.title}
                        board={board}
                        readonly={props.readonly}
                    />
                    <div className='shareButtonWrapper'>
                        {showShareButton &&
                        <ShareBoardButton
                            enableSharedBoards={props.clientConfig?.enablePublicSharedBoards || false}
                        />
                        }
                        {showShareLoginButton &&
                            <ShareBoardLoginButton/>
                        }
                        <ShareBoardTourStep/>
                    </div>
                </div>
                <ViewHeader
                    board={props.board}
                    activeView={props.activeView}
                    cards={props.cards}
                    views={props.views}
                    groupByProperty={props.groupByProperty}
                    dateDisplayProperty={props.dateDisplayProperty}
                    addCard={addEmptyCardAndShow}
                    addCardFromTemplate={addCardFromTemplate}
                    addCardTemplate={addCardTemplate}
                    editCardTemplate={editCardTemplate}
                    readonly={props.readonly}
                />
            </div>

            {activeView.fields.viewType === 'board' &&
            <Kanban
                board={props.board}
                activeView={props.activeView}
                cards={props.cards}
                groupByProperty={props.groupByProperty}
                visibleGroups={visibleGroups}
                hiddenGroups={hiddenGroups}
                selectedCardIds={selectedCardIds}
                readonly={props.readonly}
                onCardClicked={cardClicked}
                addCard={addCard}
                addCardFromTemplate={addCardFromTemplate}
                showCard={showCard}
                hiddenCardsCount={props.hiddenCardsCount}
                showHiddenCardCountNotification={hiddenCardCountNotifyHandler}
            />}
            {activeView.fields.viewType === 'table' &&
                <Table
                    board={props.board}
                    activeView={props.activeView}
                    cards={props.cards}
                    groupByProperty={props.groupByProperty}
                    views={props.views}
                    visibleGroups={visibleGroups}
                    selectedCardIds={selectedCardIds}
                    readonly={props.readonly}
                    cardIdToFocusOnRender={cardIdToFocusOnRender}
                    showCard={showCard}
                    addCard={addCard}
                    onCardClicked={cardClicked}
                    hiddenCardsCount={props.hiddenCardsCount}
                    showHiddenCardCountNotification={hiddenCardCountNotifyHandler}
                />}
            {activeView.fields.viewType === 'calendar' &&
                <CalendarFullView
                    board={props.board}
                    cards={props.cards}
                    activeView={props.activeView}
                    readonly={props.readonly}
                    dateDisplayProperty={props.dateDisplayProperty}
                    showCard={showCard}
                    addCard={(properties: Record<string, string>) => {
                        addCard('', true, properties)
                    }}
                />}

            {activeView.fields.viewType === 'gallery' &&
                <Gallery
                    board={props.board}
                    cards={props.cards}
                    activeView={props.activeView}
                    readonly={props.readonly}
                    onCardClicked={cardClicked}
                    selectedCardIds={selectedCardIds}
                    addCard={(show) => addCard('', show)}
                    hiddenCardsCount={props.hiddenCardsCount}
                    showHiddenCardCountNotification={hiddenCardCountNotifyHandler}
                />}
            <CardLimitNotification
                showHiddenCardNotification={showHiddenCardCountNotification}
                hiddenCardCountNotificationHandler={hiddenCardCountNotifyHandler}
            />
        </div>
    )
}

export default React.memo(CenterPanel)
