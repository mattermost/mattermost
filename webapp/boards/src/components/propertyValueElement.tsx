// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'

import propsRegistry from 'src/properties'

type Props = {
    board: Board
    readOnly: boolean
    card: Card
    propertyTemplate: IPropertyTemplate
    showEmptyPlaceholder: boolean
}

const PropertyValueElement = (props: Props): JSX.Element => {
    const {card, propertyTemplate, readOnly, showEmptyPlaceholder, board} = props

    let propertyValue = card.fields.properties[propertyTemplate.id]
    if (propertyValue === undefined) {
        propertyValue = ''
    }
    const property = propsRegistry.get(propertyTemplate.type)
    const Editor = property.Editor
    return (
        <Editor
            property={property}
            card={card}
            board={board}
            readOnly={readOnly}
            showEmptyPlaceholder={showEmptyPlaceholder}
            propertyTemplate={propertyTemplate}
            propertyValue={propertyValue}
        />
    )
}

export default PropertyValueElement
