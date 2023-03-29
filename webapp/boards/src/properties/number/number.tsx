// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'

import {PropertyProps} from 'src/properties/types'
import BaseTextEditor from 'src/properties/baseTextEditor'

const Number = (propertyProps: PropertyProps): JSX.Element => {

    const myValidator = useCallback(() => {
        const val = propertyProps.propertyValue as string
        if(val === '') return true
        return !isNaN(parseInt( val, 10))
    }, [propertyProps.propertyValue])

    return (
        <BaseTextEditor
            {...propertyProps}            
            validator={myValidator}
        />
    )
}
export default Number
