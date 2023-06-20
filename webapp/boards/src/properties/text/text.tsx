// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {PropertyProps} from 'src/properties/types'
import BaseTextEditor from 'src/properties/baseTextEditor'

const Text = (props: PropertyProps): JSX.Element => {
    return (
        <BaseTextEditor
            {...props}
            validator={() => true}
            spellCheck={true}
        />
    )
}
export default Text
