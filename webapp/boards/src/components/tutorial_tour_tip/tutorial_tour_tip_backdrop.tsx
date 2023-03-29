// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

export type Coords = {
    x?: string
    y?: string
}
export type TutorialTourTipPunchout = Coords & {
    width?: string
    height?: string
    handleClick?: (e: React.MouseEvent) => void
}

const TutorialTourTipBackdrop = (props: TutorialTourTipPunchout) => {
    const {x, y, width, height} = props
    if (!x || !y || !width || !height) {
        return null
    }

    const vertices = []

    // draw to top left of punch out
    vertices.push('0% 0%')
    vertices.push('0% 100%')
    vertices.push('100% 100%')
    vertices.push('100% 0%')
    vertices.push(`${x} 0%`)
    vertices.push(`${x} ${y}`)

    // draw punch out
    vertices.push(`calc(${x} + ${width}) ${y}`)
    vertices.push(`calc(${x} + ${width}) calc(${y} + ${height})`)
    vertices.push(`${x} calc(${y} + ${height})`)
    vertices.push(`${x} ${y}`)

    // close off punch out
    vertices.push(`${x} 0%`)
    vertices.push('0% 0%')

    return (
        <div
            className={'tip-backdrop'}
            style={{
                left: x,
                top: y,
                width,
                height,
            }}
            onClick={props.handleClick}
        />
    )
}

export default TutorialTourTipBackdrop
