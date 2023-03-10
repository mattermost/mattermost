// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Card} from 'src/blocks/card'
import ButtonWithMenu from 'src/widgets/buttons/buttonWithMenu'
import AddIcon from 'src/widgets/icons/add'
import Menu from 'src/widgets/menu'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentBoardTemplates} from 'src/store/cards'
import {getCurrentView} from 'src/store/views'

import NewCardButtonTemplateItem from './newCardButtonTemplateItem'
import EmptyCardButton from './emptyCardButton'

type Props = {
    addCard: () => void
    addCardFromTemplate: (cardTemplateId: string) => void
    addCardTemplate: () => void
    editCardTemplate: (cardTemplateId: string) => void
}

const NewCardButton = (props: Props): JSX.Element => {
    const cardTemplates: Card[] = useAppSelector(getCurrentBoardTemplates)
    const currentView = useAppSelector(getCurrentView)
    let defaultTemplateID = ''
    const intl = useIntl()

    return (
        <ButtonWithMenu
            onClick={() => {
                if (defaultTemplateID) {
                    props.addCardFromTemplate(defaultTemplateID)
                } else {
                    props.addCard()
                }
            }}
            text={(
                <FormattedMessage
                    id='ViewHeader.new'
                    defaultMessage='New'
                />
            )}
        >
            <Menu position='left'>
                {cardTemplates.length > 0 && <>
                    <Menu.Label>
                        <b>
                            <FormattedMessage
                                id='ViewHeader.select-a-template'
                                defaultMessage='Select a template'
                            />
                        </b>
                    </Menu.Label>

                    <Menu.Separator/>
                </>}

                {cardTemplates.map((cardTemplate) => {
                    if (cardTemplate.id === currentView.fields.defaultTemplateId) {
                        defaultTemplateID = currentView.fields.defaultTemplateId
                    }
                    return (
                        <NewCardButtonTemplateItem
                            key={cardTemplate.id}
                            cardTemplate={cardTemplate}
                            addCardFromTemplate={props.addCardFromTemplate}
                            editCardTemplate={props.editCardTemplate}
                        />
                    )
                })}

                <EmptyCardButton
                    addCard={props.addCard}
                />

                <Menu.Text
                    icon={<AddIcon/>}
                    id='add-template'
                    name={intl.formatMessage({id: 'ViewHeader.add-template', defaultMessage: 'New template'})}
                    onClick={() => props.addCardTemplate()}
                />
            </Menu>
        </ButtonWithMenu>
    )
}

export default React.memo(NewCardButton)
