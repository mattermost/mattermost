// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback} from 'react'
import {FormattedMessage, IntlShape, useIntl} from 'react-intl'

import {BlockTypes} from 'src/blocks/block'
import {Utils} from 'src/utils'
import Button from 'src/widgets/buttons/button'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'

import {contentRegistry} from 'src/components/content/contentRegistry'

import {useCardDetailContext} from './cardDetailContext'

function addContentMenu(intl: IntlShape, type: BlockTypes): JSX.Element {
    const handler = contentRegistry.getHandler(type)
    if (!handler) {
        Utils.logError(`addContentMenu, unknown content type: ${type}`)

        return <></>
    }
    const cardDetail = useCardDetailContext()
    const addElement = useCallback(async () => {
        const {card} = cardDetail
        const index = card.fields.contentOrder.length
        cardDetail.addBlock(handler, index, false)
    }, [cardDetail, handler])

    return (
        <Menu.Text
            key={type}
            id={type}
            name={handler.getDisplayText(intl)}
            icon={handler.getIcon()}
            onClick={addElement}
        />
    )
}

const CardDetailContentsMenu = () => {
    const intl = useIntl()

    return (
        <div className='CardDetailContentsMenu content add-content'>
            <MenuWrapper>
                <Button>
                    <FormattedMessage
                        id='CardDetail.add-content'
                        defaultMessage='Add content'
                    />
                </Button>
                <Menu position='top'>
                    {contentRegistry.contentTypes.map((type) => addContentMenu(intl, type))}
                </Menu>
            </MenuWrapper>
        </div>
    )
}

export default React.memo(CardDetailContentsMenu)
