// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import mutator from 'src/mutator'
import {Card} from 'src/blocks/card'
import IconButton from 'src/widgets/buttons/iconButton'
import DeleteIcon from 'src/widgets/icons/delete'
import EditIcon from 'src/widgets/icons/edit'
import OptionsIcon from 'src/widgets/icons/options'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import CheckIcon from 'src/widgets/icons/check'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentView} from 'src/store/views'
import {getCurrentBoardId} from 'src/store/boards'

type Props = {
    cardTemplate: Card
    addCardFromTemplate: (cardTemplateId: string) => void
    editCardTemplate: (cardTemplateId: string) => void
}

const NewCardButtonTemplateItem = (props: Props) => {
    const currentView = useAppSelector(getCurrentView)
    const {cardTemplate} = props
    const intl = useIntl()
    const displayName = cardTemplate.title || intl.formatMessage({id: 'ViewHeader.untitled', defaultMessage: 'Untitled'})
    const isDefaultTemplate = currentView.fields.defaultTemplateId === cardTemplate.id
    const boardId = useAppSelector(getCurrentBoardId)

    return (
        <Menu.Text
            key={cardTemplate.id}
            id={cardTemplate.id}
            name={displayName}
            icon={<div className='Icon'>{cardTemplate.fields.icon}</div>}
            className={isDefaultTemplate ? 'bold-menu-text' : ''}
            onClick={() => {
                props.addCardFromTemplate(cardTemplate.id)
            }}
            rightIcon={
                <MenuWrapper stopPropagationOnToggle={true}>
                    <IconButton icon={<OptionsIcon/>}/>
                    <Menu position='left'>
                        <Menu.Text
                            icon={<CheckIcon/>}
                            id='default'
                            name={intl.formatMessage({id: 'ViewHeader.set-default-template', defaultMessage: 'Set as default'})}
                            onClick={async () => {
                                await mutator.setDefaultTemplate(boardId, currentView.id, currentView.fields.defaultTemplateId, cardTemplate.id)
                            }}
                        />
                        <Menu.Text
                            icon={<EditIcon/>}
                            id='edit'
                            name={intl.formatMessage({id: 'ViewHeader.edit-template', defaultMessage: 'Edit'})}
                            onClick={() => {
                                props.editCardTemplate(cardTemplate.id)
                            }}
                        />
                        <Menu.Text
                            icon={<DeleteIcon/>}
                            id='delete'
                            name={intl.formatMessage({id: 'ViewHeader.delete-template', defaultMessage: 'Delete'})}
                            onClick={async () => {
                                await mutator.performAsUndoGroup(async () => {
                                    if (currentView.fields.defaultTemplateId === cardTemplate.id) {
                                        await mutator.clearDefaultTemplate(boardId, currentView.id, currentView.fields.defaultTemplateId)
                                    }
                                    await mutator.deleteBlock(cardTemplate, 'delete card template')
                                })
                            }}
                        />
                    </Menu>
                </MenuWrapper>
            }
        />
    )
}

export default React.memo(NewCardButtonTemplateItem)
