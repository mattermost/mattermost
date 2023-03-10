// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useState} from 'react'
import {useIntl} from 'react-intl'

import {Board} from 'src/blocks/board'
import CompassIcon from 'src/widgets/icons/compassIcon'
import IconButton from 'src/widgets/buttons/iconButton'
import DeleteIcon from 'src/widgets/icons/delete'
import EditIcon from 'src/widgets/icons/edit'
import DeleteBoardDialog from 'src/components/sidebar/deleteBoardDialog'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'

import './boardTemplateSelectorItem.scss'
import {Constants, Permission} from 'src/constants'

type Props = {
    isActive: boolean
    template: Board
    onSelect: (template: Board) => void
    onDelete: (template: Board) => void
    onEdit: (templateId: string) => void
}

const BoardTemplateSelectorItem = (props: Props) => {
    const {isActive, template, onEdit, onDelete, onSelect} = props
    const intl = useIntl()
    const [deleteOpen, setDeleteOpen] = useState<boolean>(false)
    const onClickHandler = useCallback(() => {
        onSelect(template)
    }, [onSelect, template])
    const onEditHandler = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onEdit(template.id)
    }, [onEdit, template])

    return (
        <div
            className={isActive ? 'BoardTemplateSelectorItem active' : 'BoardTemplateSelectorItem'}
            onClick={onClickHandler}
        >
            <span className='template-icon'>{template.icon || <CompassIcon icon='product-boards'/>}</span>
            <span className='template-name'>{template.title || intl.formatMessage({id: 'View.NewTemplateTitle', defaultMessage: 'Untitled'})}</span>

            {/* don't show template menu options for default templates */}
            {template.createdBy !== Constants.SystemUserID &&
                <div className='actions'>
                    <BoardPermissionGate
                        boardId={template.id}
                        teamId={template.teamId}
                        permissions={[Permission.DeleteBoard]}
                    >
                        <IconButton
                            icon={<DeleteIcon/>}
                            title={intl.formatMessage({id: 'BoardTemplateSelector.delete-template', defaultMessage: 'Delete'})}
                            onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                setDeleteOpen(true)
                            }}
                        />
                    </BoardPermissionGate>
                    <BoardPermissionGate
                        boardId={template.id}
                        teamId={template.teamId}
                        permissions={[Permission.ManageBoardCards, Permission.ManageBoardProperties]}
                    >
                        <IconButton
                            icon={<EditIcon/>}
                            title={intl.formatMessage({id: 'BoardTemplateSelector.edit-template', defaultMessage: 'Edit'})}
                            onClick={onEditHandler}
                        />
                    </BoardPermissionGate>
                </div>}
            {deleteOpen &&
            <DeleteBoardDialog
                boardTitle={template.title}
                onClose={() => setDeleteOpen(false)}
                isTemplate={true}
                onDelete={async () => {
                    onDelete(template)
                }}
            />}
        </div>
    )
}

export default React.memo(BoardTemplateSelectorItem)
