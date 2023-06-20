// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as React from 'react'
import {ContentBlock, ContentState} from 'draft-js'

export interface InlineStrategy {
    style: string
    findStyleRanges: (text: ContentBlock) => number[][]
    findDelimiterRanges?: (text: ContentBlock, styleRanges: number[][]) => number[][]
    delimiterStyle?: string
    styles?: React.CSSProperties
    delimiterStyles?: React.CSSProperties
}

export interface BlockStrategy {
    type: string
    className: string
    mapBlockType: (state: ContentState) => ContentState
}
