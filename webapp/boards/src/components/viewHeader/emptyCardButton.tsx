// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {useIntl} from 'react-intl'

import CardIcon from 'src/widgets/icons/card'
import Menu from 'src/widgets/menu'

import MenuWrapper from 'src/widgets/menuWrapper'
import OptionsIcon from 'src/widgets/icons/options'
import IconButton from 'src/widgets/buttons/iconButton'
import CheckIcon from 'src/widgets/icons/check'
import mutator from 'src/mutator'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentView} from 'src/store/views'
import {getCurrentBoardId} from 'src/store/boards'

type Props = {
    addCard: () => void
}

const EmptyCardButton = (props: Props) => {
    const currentView = useAppSelector(getCurrentView)
    const boardId = useAppSelector(getCurrentBoardId)
    const intl = useIntl()

    return (
        <Menu.Text
            icon={<CardIcon/>}
            id='empty-template'
            name={intl.formatMessage({id: 'ViewHeader.empty-card', defaultMessage: 'Empty card'})}
            className={currentView.fields.defaultTemplateId ? '' : 'bold-menu-text'}
            onClick={() => {
                props.addCard()
            }}
            rightIcon={
                <MenuWrapper stopPropagationOnToggle={true}>
                    <IconButton icon={<OptionsIcon/>}/>
                    <Menu position='left'>
                        <Menu.Text
                            icon={<CheckIcon/>}
                            id='default'
                            name={intl.formatMessage({
                                id: 'ViewHeader.set-default-template',
                                defaultMessage: 'Set as default',
                            })}
                            onClick={async () => {
                                await mutator.clearDefaultTemplate(boardId, currentView.id, currentView.fields.defaultTemplateId)
                            }}
                        />
                    </Menu>
                </MenuWrapper>
            }
        />)
}

export default React.memo(EmptyCardButton)
