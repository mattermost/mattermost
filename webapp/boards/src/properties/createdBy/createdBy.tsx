// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import Person from 'src/properties/person/person'
import {PropertyProps} from 'src/properties/types'

const CreatedBy = (props: PropertyProps): JSX.Element => {
    return (
        <Person
            {...props}
            propertyValue={props.card.createdBy}
            readOnly={true} // created by is an immutable property, so will always be readonly
        />
    )
}

export default CreatedBy
