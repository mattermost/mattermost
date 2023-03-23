// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'

import FullCalendar, {
    EventChangeArg,
    EventInput,
    EventContentArg,
    DayCellContentArg
} from '@fullcalendar/react'

import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'

import {DatePropertyType} from 'src/properties/types'

import mutator from 'src/mutator'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import {Card} from 'src/blocks/card'
import {DateProperty} from 'src/properties/date/date'
import propsRegistry from 'src/properties'
import Tooltip from 'src/widgets/tooltip'
import PropertyValueElement from 'src/components/propertyValueElement'
import {Constants, Permission} from 'src/constants'
import {useHasCurrentBoardPermissions} from 'src/hooks/permissions'
import CardBadges from 'src/components/cardBadges'
import ConfirmationDialogBox, {ConfirmationDialogBoxProps} from 'src/components/confirmationDialogBox'

import './fullcalendar.scss'
import MenuWrapper from 'src/widgets/menuWrapper'
import CardActionsMenu from 'src/components/cardActionsMenu/cardActionsMenu'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'
import CardActionsMenuIcon from 'src/components/cardActionsMenu/cardActionsMenuIcon'

const oneDay = 60 * 60 * 24 * 1000

type Props = {
    board: Board
    cards: Card[]
    activeView: BoardView
    readonly: boolean
    initialDate?: Date
    dateDisplayProperty?: IPropertyTemplate
    showCard: (cardId: string) => void
    addCard: (properties: Record<string, string>) => void
}

function createDatePropertyFromCalendarDates(start: Date, end: Date): DateProperty {
    // save as noon local, expected from the date picker
    start.setHours(12)
    const dateFrom = start.getTime() - timeZoneOffset(start.getTime())
    end.setHours(12)
    const dateTo = end.getTime() - timeZoneOffset(end.getTime()) - oneDay // subtract one day. Calendar is date exclusive

    const dateProperty: DateProperty = {from: dateFrom}
    if (dateTo !== dateFrom) {
        dateProperty.to = dateTo
    }
    return dateProperty
}

function createDatePropertyFromCalendarDate(start: Date): DateProperty {
    // save as noon local, expected from the date picker
    start.setHours(12)
    const dateFrom = start.getTime() - timeZoneOffset(start.getTime())

    const dateProperty: DateProperty = {from: dateFrom}
    return dateProperty
}

const timeZoneOffset = (date: number): number => {
    return new Date(date).getTimezoneOffset() * 60 * 1000
}

const CalendarFullView = (props: Props): JSX.Element|null => {
    const intl = useIntl()
    const {board, cards, activeView, dateDisplayProperty, readonly} = props
    const isSelectable = !readonly
    const canAddCards = useHasCurrentBoardPermissions([Permission.ManageBoardCards])
    const [showConfirmationDialogBox, setShowConfirmationDialogBox] = useState<boolean>(false)
    const [cardItem, setCardItem] = useState<Card>()

    const visiblePropertyTemplates = useMemo(() => (
        board.cardProperties.filter((template: IPropertyTemplate) => activeView.fields.visiblePropertyIds.includes(template.id))
    ), [board.cardProperties, activeView.fields.visiblePropertyIds])

    let {initialDate} = props
    if (!initialDate) {
        initialDate = new Date()
    }

    const isEditable = useCallback((): boolean => {
        if (readonly || !dateDisplayProperty || propsRegistry.get(dateDisplayProperty.type).isReadOnly) {
            return false
        }
        return true
    }, [readonly, dateDisplayProperty])

    const myEventsList = useMemo(() => (
        cards.flatMap((card): EventInput[] => {
            const property = propsRegistry.get(dateDisplayProperty?.type || 'unknown')

            let dateFrom = new Date(card.createAt || 0)
            let dateTo = new Date(card.createAt || 0)
            if (property instanceof DatePropertyType) {
                const dateFromValue = property.getDateFrom(card.fields.properties[dateDisplayProperty?.id || ''], card)
                if (!dateFromValue) {
                    return []
                }
                dateFrom = dateFromValue
                const dateToValue = property.getDateTo(card.fields.properties[dateDisplayProperty?.id || ''], card)
                dateTo = dateToValue || new Date(dateFrom)

                //full calendar end date is exclusive, so increment by 1 day.
                dateTo.setDate(dateTo.getDate() + 1)
            }
            return [{
                id: card.id,
                title: card.title,
                extendedProps: {icon: card.fields.icon},
                properties: card.fields.properties,
                allDay: true,
                start: dateFrom,
                end: dateTo,
            }]
        })
    ), [cards, dateDisplayProperty])

    const visibleBadges = activeView.fields.visiblePropertyIds.includes(Constants.badgesColumnId)

    const openConfirmationDialogBox = (card: Card) => {
        setShowConfirmationDialogBox(true)
        setCardItem(card)
    }

    const handleDeleteCard = useCallback(() => {
        if (!cardItem) {
            return
        }
        mutator.deleteBlock(cardItem, 'delete card')
        setShowConfirmationDialogBox(false)
    }, [cardItem, board.id])

    const confirmDialogProps: ConfirmationDialogBoxProps = useMemo(() => {
        return {
            heading: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-heading', defaultMessage: 'Confirm card delete!'}),
            confirmButtonText: intl.formatMessage({id: 'CardDialog.delete-confirmation-dialog-button-text', defaultMessage: 'Delete'}),
            onConfirm: handleDeleteCard,
            onClose: () => {
                setShowConfirmationDialogBox(false)
            },
        }
    }, [handleDeleteCard])

    const renderEventContent = (eventProps: EventContentArg): JSX.Element|null => {
        const {event} = eventProps
        const card = cards.find((o) => o.id === event.id) || cards[0]

        return (
            <>
                <div
                    className='EventContent'
                    onClick={() => props.showCard(event.id)}
                >
                    {!props.readonly &&
                    <MenuWrapper
                        className='optionsMenu'
                        stopPropagationOnToggle={true}
                    >
                        <CardActionsMenuIcon/>
                        <CardActionsMenu
                            cardId={card.id}
                            boardId={card.boardId}
                            onClickDelete={() => openConfirmationDialogBox(card)}
                            onClickDuplicate={() => {
                                TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DuplicateCard, {board: board.id, card: card.id})
                                mutator.duplicateCard(card.id, board.id)
                            }}
                        />
                    </MenuWrapper>}
                    <div className='octo-icontitle'>
                        { event.extendedProps.icon ? <div className='octo-icon'>{event.extendedProps.icon}</div> : undefined }
                        <div
                            className='fc-event-title'
                            key='__title'
                        >{event.title || intl.formatMessage({id: 'CalendarCard.untitled', defaultMessage: 'Untitled'})}</div>
                    </div>
                    {visiblePropertyTemplates.map((template) => (
                        <Tooltip
                            key={template.id}
                            title={template.name}
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
                    {visibleBadges &&
                    <CardBadges card={card}/> }
                </div>
            </>
        )
    }

    const eventChange = useCallback((eventProps: EventChangeArg) => {
        const {event} = eventProps
        if (!event.start) {
            return
        }
        if (!event.end) {
            return
        }

        const startDate = new Date(event.start.getTime())
        const endDate = new Date(event.end.getTime())
        const dateProperty = createDatePropertyFromCalendarDates(startDate, endDate)
        const card = cards.find((o) => o.id === event.id)
        if (card && dateDisplayProperty) {
            mutator.changePropertyValue(board.id, card, dateDisplayProperty.id, JSON.stringify(dateProperty))
        }
    }, [cards, dateDisplayProperty])

    const onNewEvent = useCallback((args: {start: Date, end: Date}) => {
        let dateProperty: DateProperty
        if (args.start === args.end) {
            dateProperty = createDatePropertyFromCalendarDate(args.start)
        } else {
            dateProperty = createDatePropertyFromCalendarDates(args.start, args.end)
            if (dateProperty.to === undefined) {
                return
            }
        }

        const properties: Record<string, string> = {}
        if (dateDisplayProperty) {
            properties[dateDisplayProperty.id] = JSON.stringify(dateProperty)
        }

        props.addCard(properties)
    }, [props.addCard, dateDisplayProperty])

    const toolbar = useMemo(() => ({
        left: 'title',
        center: '',
        right: 'dayGridWeek dayGridMonth prev,today,next',
    }), [])

    const buttonText = useMemo(() => ({
        today: intl.formatMessage({id: 'calendar.today', defaultMessage: 'TODAY'}),
        month: intl.formatMessage({id: 'calendar.month', defaultMessage: 'Month'}),
        week: intl.formatMessage({id: 'calendar.week', defaultMessage: 'Week'}),
    }), [])

    const dayCellContent = useCallback((args: DayCellContentArg): JSX.Element|null => {
        return (
            <div className={'dateContainer ' + (canAddCards ? 'with-plus' : '')}>
                <div
                    className='addEvent'
                    onClick={() => onNewEvent({start: args.date, end: args.date})}
                >
                    {'+'}
                </div>
                <div className='dateDisplay'>
                    {args.dayNumberText}
                </div>
            </div>
        )
    }, [dateDisplayProperty, canAddCards])

    return (
        <div
            className='CalendarContainer'
        >
            <FullCalendar
                key={activeView.id}
                dayCellContent={dayCellContent}
                dayMaxEventRows={5}
                initialDate={initialDate}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView='dayGridMonth'
                events={myEventsList}
                editable={isEditable()}
                eventResizableFromStart={isEditable()}
                headerToolbar={toolbar}
                buttonText={buttonText}
                eventContent={renderEventContent}
                eventChange={eventChange}
                selectable={isSelectable}
                selectMirror={true}
                select={onNewEvent}
            />
            {showConfirmationDialogBox && <ConfirmationDialogBox dialogBox={confirmDialogProps}/>}
        </div>
    )
}

export default CalendarFullView
