// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useCallback} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {BlockIcons} from 'src/blockIcons'
import {Board} from 'src/blocks/board'
import mutator from 'src/mutator'
import Button from 'src/widgets/buttons/button'
import Editable from 'src/widgets/editable'
import CompassIcon from 'src/widgets/icons/compassIcon'
import {Permission} from 'src/constants'
import {useHasCurrentBoardPermissions} from 'src/hooks/permissions'

import BoardIconSelector from './boardIconSelector'
import {MarkdownEditor} from './markdownEditor'
import './viewTitle.scss'

type Props = {
    board: Board
    readonly: boolean
}

const ViewTitle = (props: Props) => {
    const {board} = props

    const [title, setTitle] = useState(board.title)
    const onEditTitleSave = useCallback(() => mutator.changeBoardTitle(board.id, board.title, title), [board.id, board.title, title])
    const onEditTitleCancel = useCallback(() => setTitle(board.title), [board.title])
    const onDescriptionBlur = useCallback((text) => mutator.changeBoardDescription(board.id, board.id, board.description, text), [board.id, board.description])
    const onAddRandomIcon = useCallback(() => {
        const newIcon = BlockIcons.shared.randomIcon()
        mutator.changeBoardIcon(board.id, board.icon, newIcon)
    }, [board.id, board.icon])
    const onShowDescription = useCallback(() => mutator.showBoardDescription(board.id, Boolean(board.showDescription), true), [board.id, board.showDescription])
    const onHideDescription = useCallback(() => mutator.showBoardDescription(board.id, Boolean(board.showDescription), false), [board.id, board.showDescription])
    const canEditBoardProperties = useHasCurrentBoardPermissions([Permission.ManageBoardProperties])

    const readonly = props.readonly || !canEditBoardProperties

    const intl = useIntl()

    return (
        <div className='ViewTitle'>
            <div className='add-buttons add-visible'>
                {!readonly && !board.icon &&
                    <Button
                        emphasis='default'
                        size='xsmall'
                        onClick={onAddRandomIcon}
                        icon={
                            <CompassIcon
                                icon='emoticon-outline'
                            />}
                    >
                        <FormattedMessage
                            id='TableComponent.add-icon'
                            defaultMessage='Add icon'
                        />
                    </Button>
                }
                {!readonly && board.showDescription &&
                    <Button
                        emphasis='default'
                        size='xsmall'
                        onClick={onHideDescription}
                        icon={
                            <CompassIcon
                                icon='eye-off-outline'
                            />}
                    >
                        <FormattedMessage
                            id='ViewTitle.hide-description'
                            defaultMessage='hide description'
                        />
                    </Button>
                }
                {!readonly && !board.showDescription &&
                    <Button
                        emphasis='default'
                        size='xsmall'
                        onClick={onShowDescription}
                        icon={
                            <CompassIcon
                                icon='eye-outline'
                            />}
                    >
                        <FormattedMessage
                            id='ViewTitle.show-description'
                            defaultMessage='show description'
                        />
                    </Button>
                }
            </div>

            <div className='title'>
                <BoardIconSelector
                    board={board}
                    readonly={readonly}
                />
                <Editable
                    className='title'
                    value={title}
                    placeholderText={intl.formatMessage({id: 'ViewTitle.untitled-board', defaultMessage: 'Untitled board'})}
                    onChange={(newTitle) => setTitle(newTitle)}
                    saveOnEsc={true}
                    onSave={onEditTitleSave}
                    onCancel={onEditTitleCancel}
                    readonly={readonly}
                    spellCheck={true}
                />
            </div>

            {board.showDescription &&
                <div className='description'>
                    <MarkdownEditor
                        text={board.description}
                        placeholderText='Add a description...'
                        onBlur={onDescriptionBlur}
                        readonly={readonly}
                    />
                </div>
            }
        </div>
    )
}

export default React.memo(ViewTitle)
