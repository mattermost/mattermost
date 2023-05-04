// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'
import {IntlShape, injectIntl} from 'react-intl'
import {generatePath, useHistory, useRouteMatch} from 'react-router-dom'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {BoardView, IViewType, createBoardView} from 'src/blocks/boardView'
import {Constants, Permission} from 'src/constants'
import mutator from 'src/mutator'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'
import {Block} from 'src/blocks/block'
import {IDType, Utils} from 'src/utils'
import AddIcon from 'src/widgets/icons/add'
import BoardIcon from 'src/widgets/icons/board'
import CalendarIcon from 'src/widgets/icons/calendar'
import DeleteIcon from 'src/widgets/icons/delete'
import DuplicateIcon from 'src/widgets/icons/duplicate'
import GalleryIcon from 'src/widgets/icons/gallery'
import TableIcon from 'src/widgets/icons/table'
import Menu from 'src/widgets/menu'

import BoardPermissionGate from './permissions/boardPermissionGate'
import './viewMenu.scss'

type Props = {
    board: Board
    activeView: BoardView
    views: BoardView[]
    intl: IntlShape
    readonly: boolean
    allowCreateView: () => boolean
}

const ViewMenu = (props: Props) => {
    const history = useHistory()
    const match = useRouteMatch()

    const showView = useCallback((viewId) => {
        let newPath = generatePath(Utils.getBoardPagePath(match.path), {...match.params, viewId: viewId || ''})
        if (props.readonly) {
            newPath += `?r=${Utils.getReadToken()}`
        }
        history.push(newPath)
    }, [match, history])

    const handleDuplicateView = useCallback(() => {
        const {board, activeView} = props
        Utils.log('duplicateView')

        if (!props.allowCreateView()) {
            return
        }

        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DuplicateBoardView, {board: board.id, view: activeView.id})
        const currentViewId = activeView.id
        const newView = createBoardView(activeView)
        newView.title = `${activeView.title} copy`
        newView.id = Utils.createGuid(IDType.View)
        mutator.insertBlock(
            newView.boardId,
            newView,
            'duplicate view',
            async (block: Block) => {
                // This delay is needed because WSClient has a default 100 ms notification delay before updates
                setTimeout(() => {
                    showView(block.id)
                }, 120)
            },
            async () => {
                showView(currentViewId)
            },
        )
    }, [props.activeView, showView])

    const handleDeleteView = useCallback(() => {
        const {board, activeView, views} = props
        Utils.log('deleteView')
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DeleteBoardView, {board: board.id, view: activeView.id})
        const view = activeView
        const nextView = views.find((o) => o.id !== view.id)
        mutator.deleteBlock(view, 'delete view')
        if (nextView) {
            showView(nextView.id)
        }
    }, [props.views, props.activeView, showView])

    const handleViewClick = useCallback((id: string) => {
        const {views} = props
        Utils.log('view ' + id)
        const view = views.find((o) => o.id === id)
        Utils.assert(view, `view not found: ${id}`)
        if (view) {
            showView(view.id)
        }
    }, [props.views, showView])

    const handleAddViewBoard = useCallback(() => {
        const {board, activeView, intl} = props
        Utils.log('addview-board')

        if (!props.allowCreateView()) {
            return
        }

        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateBoardView, {board: board.id, view: activeView.id})
        const view = createBoardView()
        view.title = intl.formatMessage({id: 'View.NewBoardTitle', defaultMessage: 'Board view'})
        view.fields.viewType = 'board'
        view.boardId = board.id

        const oldViewId = activeView.id

        mutator.insertBlock(
            view.boardId,
            view,
            'add view',
            async (block: Block) => {
                // This delay is needed because WSClient has a default 100 ms notification delay before updates
                setTimeout(() => {
                    showView(block.id)
                }, 120)
            },
            async () => {
                showView(oldViewId)
            })
    }, [props.activeView, props.board, props.intl, showView])

    const handleAddViewTable = useCallback(() => {
        const {board, activeView, intl} = props

        Utils.log('addview-table')

        if (!props.allowCreateView()) {
            return
        }

        const view = createBoardView()
        view.title = intl.formatMessage({id: 'View.NewTableTitle', defaultMessage: 'Table view'})
        view.fields.viewType = 'table'
        view.boardId = board.id
        view.fields.visiblePropertyIds = board.cardProperties.map((o: IPropertyTemplate) => o.id)
        view.fields.columnWidths = {}
        view.fields.columnWidths[Constants.titleColumnId] = Constants.defaultTitleColumnWidth

        const oldViewId = activeView.id

        mutator.insertBlock(
            view.boardId,
            view,
            'add view',
            async (block: Block) => {
                // This delay is needed because WSClient has a default 100 ms notification delay before updates
                setTimeout(() => {
                    Utils.log(`showView: ${block.id}`)
                    showView(block.id)
                }, 120)
            },
            async () => {
                showView(oldViewId)
            })
    }, [props.activeView, props.board, props.intl, showView])

    const handleAddViewGallery = useCallback(() => {
        const {board, activeView, intl} = props

        Utils.log('addview-gallery')

        if (!props.allowCreateView()) {
            return
        }

        const view = createBoardView()
        view.title = intl.formatMessage({id: 'View.NewGalleryTitle', defaultMessage: 'Gallery view'})
        view.fields.viewType = 'gallery'
        view.boardId = board.id
        view.fields.visiblePropertyIds = [Constants.titleColumnId]

        const oldViewId = activeView.id

        mutator.insertBlock(
            view.boardId,
            view,
            'add view',
            async (block: Block) => {
                // This delay is needed because WSClient has a default 100 ms notification delay before updates
                setTimeout(() => {
                    Utils.log(`showView: ${block.id}`)
                    showView(block.id)
                }, 120)
            },
            async () => {
                showView(oldViewId)
            })
    }, [props.board, props.activeView, props.intl, showView])

    const handleAddViewCalendar = useCallback(() => {
        const {board, activeView, intl} = props

        Utils.log('addview-calendar')

        if (!props.allowCreateView()) {
            return
        }

        const view = createBoardView()
        view.title = intl.formatMessage({id: 'View.NewCalendarTitle', defaultMessage: 'Calendar view'})
        view.fields.viewType = 'calendar'
        view.parentId = board.id
        view.boardId = board.id
        view.fields.visiblePropertyIds = [Constants.titleColumnId]

        const oldViewId = activeView.id

        // Find first date property
        view.fields.dateDisplayPropertyId = board.cardProperties.find((o: IPropertyTemplate) => o.type === 'date')?.id

        mutator.insertBlock(
            view.boardId,
            view,
            'add view',
            async (block: Block) => {
                // This delay is needed because WSClient has a default 100 ms notification delay before updates
                setTimeout(() => {
                    Utils.log(`showView: ${block.id}`)
                    showView(block.id)
                }, 120)
            },
            async () => {
                showView(oldViewId)
            })
    }, [props.board, props.activeView, props.intl, showView])

    const {views, intl} = props

    const duplicateViewText = intl.formatMessage({
        id: 'View.DuplicateView',
        defaultMessage: 'Duplicate view',
    })
    const deleteViewText = intl.formatMessage({
        id: 'View.DeleteView',
        defaultMessage: 'Delete view',
    })
    const addViewText = intl.formatMessage({
        id: 'View.AddView',
        defaultMessage: 'Add view',
    })
    const boardText = intl.formatMessage({
        id: 'View.Board',
        defaultMessage: 'Board',
    })
    const tableText = intl.formatMessage({
        id: 'View.Table',
        defaultMessage: 'Table',
    })
    const galleryText = intl.formatMessage({
        id: 'View.Gallery',
        defaultMessage: 'Gallery',
    })

    const iconForViewType = (viewType: IViewType) => {
        switch (viewType) {
        case 'board': return <BoardIcon/>
        case 'table': return <TableIcon/>
        case 'gallery': return <GalleryIcon/>
        case 'calendar': return <CalendarIcon/>
        default: return <div/>
        }
    }

    return (
        <div className='ViewMenu'>
            <Menu>
                <div className='view-list'>
                    {views.map((view: BoardView) => (
                        <Menu.Text
                            key={view.id}
                            id={view.id}
                            name={view.title}
                            icon={iconForViewType(view.fields.viewType)}
                            onClick={handleViewClick}
                        />))}
                </div>
                <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                    <Menu.Separator/>
                </BoardPermissionGate>
                {!props.readonly &&
                <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                    <Menu.Text
                        id='__duplicateView'
                        name={duplicateViewText}
                        icon={<DuplicateIcon/>}
                        onClick={handleDuplicateView}
                    />
                </BoardPermissionGate>
                }
                {!props.readonly && views.length > 1 &&
                <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                    <Menu.Text
                        id='__deleteView'
                        name={deleteViewText}
                        icon={<DeleteIcon/>}
                        onClick={handleDeleteView}
                    />
                </BoardPermissionGate>
                }
                {!props.readonly &&
                <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                    <Menu.SubMenu
                        id='__addView'
                        name={addViewText}
                        icon={<AddIcon/>}
                    >
                        <div className='subMenu'>
                            <Menu.Text
                                id='board'
                                name={boardText}
                                icon={<BoardIcon/>}
                                onClick={handleAddViewBoard}
                            />
                            <Menu.Text
                                id='table'
                                name={tableText}
                                icon={<TableIcon/>}
                                onClick={handleAddViewTable}
                            />
                            <Menu.Text
                                id='gallery'
                                name={galleryText}
                                icon={<GalleryIcon/>}
                                onClick={handleAddViewGallery}
                            />
                            <Menu.Text
                                id='calendar'
                                name='Calendar'
                                icon={<CalendarIcon/>}
                                onClick={handleAddViewCalendar}
                            />
                        </div>
                    </Menu.SubMenu>
                </BoardPermissionGate>
                }
            </Menu>
        </div>
    )
}

export default injectIntl(React.memo(ViewMenu))
