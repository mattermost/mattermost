// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {PropertyProps} from 'src/properties/types'
import BaseTextEditor from 'src/properties/baseTextEditor'

const Phone = (props: PropertyProps): JSX.Element => {
    return (
        <BaseTextEditor
            {...props}
            validator={() => true}
        />
    )
}
export default Phone
