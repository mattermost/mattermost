// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import './pulsating_dot.scss'
import {Coords} from 'src/components/tutorial_tour_tip/tutorial_tour_tip_backdrop'

type Props = {
    targetRef?: React.RefObject<HTMLImageElement>
    className?: string
    onClick?: (e: React.MouseEvent) => void
    coords?: Coords
}

const PulsatingDot = (props: Props): JSX.Element => {
    let customStyles = {}
    if (props?.coords) {
        customStyles = {
            transform: `translate(${props.coords?.x}px, ${props.coords?.y}px)`,
        }
    }
    let effectiveClassName = 'pulsating_dot'
    if (props.onClick) {
        effectiveClassName += ' pulsating_dot-clickable'
    }
    if (props.className) {
        effectiveClassName = effectiveClassName + ' ' + props.className
    }

    return (
        <span
            className={effectiveClassName}
            onClick={props.onClick}
            ref={props.targetRef}
            style={{...customStyles}}
        />
    )
}

export default PulsatingDot
