// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {PropertyProps} from 'src/properties/types'
import BaseTextEditor from 'src/properties/baseTextEditor'

const Email = (props: PropertyProps): JSX.Element => {
    return (
        <BaseTextEditor
            {...props}
            validator={() => {
                const emailRegexp = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

                return emailRegexp.test(props.propertyValue as string)
            }}
        />
    )
}
export default Email
