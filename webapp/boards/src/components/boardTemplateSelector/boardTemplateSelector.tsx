// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    useEffect,
    useState,
    useCallback,
    useMemo
} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {useHistory, useRouteMatch} from 'react-router-dom'
import {useHotkeys} from 'react-hotkeys-hook'

import CompassIcon from 'src/widgets/icons/compassIcon'

import {Board} from 'src/blocks/board'
import IconButton from 'src/widgets/buttons/iconButton'
import CloseIcon from 'src/widgets/icons/close'
import Button from 'src/widgets/buttons/button'
import octoClient from 'src/octoClient'
import mutator from 'src/mutator'
import {getTemplates, getCurrentBoardId} from 'src/store/boards'
import {getCurrentTeam, Team} from 'src/store/teams'
import {fetchGlobalTemplates, getGlobalTemplates} from 'src/store/globalTemplates'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

import './boardTemplateSelector.scss'
import {OnboardingBoardTitle} from 'src/components/cardDetail/cardDetail'
import {IUser, UserConfigPatch} from 'src/user'
import {getMe, patchProps} from 'src/store/users'
import {BaseTourSteps, TOUR_BASE} from 'src/components/onboardingTour'

import {Utils} from 'src/utils'

import {Constants} from 'src/constants'

import BoardTemplateSelectorPreview from './boardTemplateSelectorPreview'
import BoardTemplateSelectorItem from './boardTemplateSelectorItem'

type Props = {
    title?: React.ReactNode
    description?: React.ReactNode
    onClose?: () => void
    channelId?: string
}

const BoardTemplateSelector = (props: Props) => {
    const globalTemplates = useAppSelector<Board[]>(getGlobalTemplates) || []
    const currentBoardId = useAppSelector<string>(getCurrentBoardId) || null
    const currentTeam = useAppSelector<Team|null>(getCurrentTeam)
    const {title, description, onClose} = props
    const dispatch = useAppDispatch()
    const intl = useIntl()
    const history = useHistory()
    const match = useRouteMatch<{boardId: string, viewId?: string}>()
    const me = useAppSelector<IUser|null>(getMe)

    useHotkeys('esc', () => props.onClose?.())

    const showBoard = useCallback(async (boardId) => {
        Utils.showBoard(boardId, match, history)
        if (onClose) {
            onClose()
        }
    }, [match, history, onClose])

    useEffect(() => {
        if (octoClient.teamId !== Constants.globalTeamId && globalTemplates.length === 0) {
            dispatch(fetchGlobalTemplates())
        }
    }, [octoClient.teamId])

    const onBoardTemplateDelete = useCallback((template: Board) => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DeleteBoardTemplate, {board: template.id})
        mutator.deleteBoard(
            template,
            intl.formatMessage({id: 'BoardTemplateSelector.delete-template', defaultMessage: 'Delete'}),
            async () => {},
            async () => {
                showBoard(template.id)
            },
        )
    }, [showBoard])

    const unsortedTemplates = useAppSelector(getTemplates)
    const templates = useMemo(() => Object.values(unsortedTemplates).sort((a: Board, b: Board) => a.createAt - b.createAt), [unsortedTemplates])
    const allTemplates = globalTemplates.concat(templates)

    const resetTour = async () => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.StartTour)

        if (!me) {
            return
        }

        const patch: UserConfigPatch = {
            updatedFields: {
                onboardingTourStarted: '1',
                onboardingTourStep: BaseTourSteps.OPEN_A_CARD.toString(),
                tourCategory: TOUR_BASE,
            },
        }

        const patchedProps = await octoClient.patchUserConfig(me.id, patch)
        if (patchedProps) {
            await dispatch(patchProps(patchedProps))
        }
    }

    const handleUseTemplate = async () => {
        if (activeTemplate.teamId === '0') {
            TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateBoardViaTemplate, {boardTemplateId: activeTemplate.properties.trackingTemplateId as string, channelID: props.channelId})
        }

        const boardsAndBlocks = await mutator.addBoardFromTemplate(currentTeam?.id || Constants.globalTeamId, intl, showBoard, () => showBoard(currentBoardId), activeTemplate.id, currentTeam?.id)
        const board = boardsAndBlocks.boards[0]
        await mutator.updateBoard({...board, channelId: props.channelId || ''}, board, 'linked channel')
        if (activeTemplate.title === OnboardingBoardTitle) {
            resetTour()
        }
    }

    const [activeTemplate, setActiveTemplate] = useState<Board>(allTemplates[0])

    useEffect(() => {
        if (!activeTemplate) {
            setActiveTemplate(templates.concat(globalTemplates)[0])
        }
    }, [templates, globalTemplates])

    if (!allTemplates) {
        return <div/>
    }

    return (
        <div className={`BoardTemplateSelector__container ${onClose ? '' : 'BoardTemplateSelector__container--page'}`}>
            {onClose &&
                <div
                    onClick={onClose}
                    className='BoardTemplateSelector__backdrop'
                />}
            <div className='BoardTemplateSelector'>
                <div className='toolbar'>
                    {onClose &&
                        <IconButton
                            size='medium'
                            onClick={onClose}
                            icon={<CloseIcon/>}
                            title={'Close'}
                        />}
                </div>
                <div className='header'>
                    <h1 className='title'>
                        {title || (
                            <FormattedMessage
                                id='BoardTemplateSelector.title'
                                defaultMessage='Create a board'
                            />
                        )}
                    </h1>
                    <p className='description'>
                        {description || (
                            <FormattedMessage
                                id='BoardTemplateSelector.description'
                                defaultMessage='Add a board to the sidebar using any of the templates defined below or start from scratch.'
                            />
                        )}
                    </p>
                </div>
                <div className='templates'>
                    <div className='templates-sidebar'>
                        <div className='templates-list'>
                            <Button
                                emphasis='link'
                                size='medium'
                                icon={<CompassIcon icon='plus'/>}
                                className='new-template'
                                onClick={() => mutator.addEmptyBoardTemplate(currentTeam?.id || '', intl, showBoard, () => showBoard(currentBoardId))}
                            >
                                <FormattedMessage
                                    id='BoardTemplateSelector.add-template'
                                    defaultMessage='Create new template'
                                />
                            </Button>
                            {allTemplates.map((boardTemplate) => (
                                <BoardTemplateSelectorItem
                                    key={boardTemplate.id}
                                    isActive={activeTemplate?.id === boardTemplate.id}
                                    template={boardTemplate}
                                    onSelect={setActiveTemplate}
                                    onDelete={onBoardTemplateDelete}
                                    onEdit={showBoard}
                                />
                            ))}
                        </div>
                        <div className='templates-sidebar__footer'>
                            <Button
                                emphasis='secondary'
                                size={'medium'}
                                icon={<CompassIcon icon='kanban'/>}
                                onClick={async () => {
                                    const boardsAndBlocks = await mutator.addEmptyBoard(currentTeam?.id || '', intl, showBoard, () => showBoard(currentBoardId))
                                    const board = boardsAndBlocks.boards[0]
                                    await mutator.updateBoard({...board, channelId: props.channelId || ''}, board, 'linked channel')
                                }}
                            >
                                <FormattedMessage
                                    id='BoardTemplateSelector.create-empty-board'
                                    defaultMessage='Create empty board'
                                />
                            </Button>
                        </div>
                    </div>
                    <div className='templates-content'>
                        <div className='template-preview-box'>
                            <BoardTemplateSelectorPreview activeTemplate={activeTemplate}/>
                        </div>
                        <div className='buttons'>
                            <Button
                                filled={true}
                                size={'medium'}
                                onClick={handleUseTemplate}
                            >
                                <FormattedMessage
                                    id='BoardTemplateSelector.use-this-template'
                                    defaultMessage='Use this template'
                                />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default React.memo(BoardTemplateSelector)
