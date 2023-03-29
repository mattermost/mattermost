// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {forwardRef, useEffect, useRef} from 'react'

import {EditableProps, Focusable, useEditable} from './editable'

import './editableArea.scss'

function getBorderWidth(style: CSSStyleDeclaration): number {
    return parseInt(style.borderTopWidth || '0', 10) + parseInt(style.borderBottomWidth || '0', 10)
}

const EditableArea = (props: EditableProps, ref: React.Ref<Focusable>): JSX.Element => {
    const elementRef = useRef<HTMLTextAreaElement>(null)
    const referenceRef = useRef<HTMLTextAreaElement>(null)
    const heightRef = useRef(0)
    const elementProps = useEditable(props, ref, elementRef)

    useEffect(() => {
        if (!elementRef.current || !referenceRef.current) {
            return
        }

        const height = referenceRef.current.scrollHeight
        const textarea = elementRef.current

        if (height > 0 && height !== heightRef.current) {
            const style = getComputedStyle(textarea)
            const borderWidth = getBorderWidth(style)

            // Directly change the height to avoid circular rerenders
            textarea.style.height = String(height + borderWidth) + 'px'

            heightRef.current = height
        }
    })

    const heightProps = {
        height: heightRef.current,
        rows: 1,
    }

    return (
        <div className={'EditableAreaWrap'}>
            <textarea
                {...elementProps}
                {...heightProps}
                ref={elementRef}
                className={'EditableArea ' + elementProps.className}
            />
            <div className={'EditableAreaContainer'}>
                <textarea
                    ref={referenceRef}
                    className={'EditableAreaReference ' + elementProps.className}
                    dir='auto'
                    disabled={true}
                    rows={1}
                    value={elementProps.value}
                    aria-hidden={true}
                />
            </div>
        </div>
    )
}

export default forwardRef(EditableArea)
