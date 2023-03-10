// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useRef} from 'react'

import {useColumnResize} from './tableColumnResizeContext'
import './horizontalGrip.scss'

type Props = {
    templateId: string
    columnWidth: number
    onAutoSizeColumn: (columnID: string) => void
}

type OffsetCallback = (offset: number) => void

function useResizable(liveOffset: OffsetCallback, finalOffset: OffsetCallback) {
    const state = useRef({
        initialX: 0,
        lastOffset: 0,
        isResizing: false,
    })

    const updateOffset = useCallback((event: MouseEvent) => {
        state.current.lastOffset = event.clientX - state.current.initialX
        liveOffset(state.current.lastOffset)
    }, [liveOffset])

    const stopResizing = useCallback(() => {
        if (state.current.isResizing) {
            state.current.isResizing = false
            document.removeEventListener('mousemove', updateOffset)
            document.removeEventListener('mouseup', stopResizing)
            document.body.style.userSelect = ''
            finalOffset(state.current.lastOffset)
        }
    }, [updateOffset])

    useEffect(() => stopResizing, [stopResizing])

    return useCallback((event: React.MouseEvent) => {
        state.current = {
            initialX: event.clientX,
            lastOffset: 0,
            isResizing: true,
        }
        document.addEventListener('mousemove', updateOffset)
        document.addEventListener('mouseup', stopResizing)
        document.body.style.userSelect = 'none'
        event.preventDefault()
    }, [updateOffset, stopResizing])
}

const HorizontalGrip = (props: Props): JSX.Element => {
    const {templateId, onAutoSizeColumn} = props
    const columnResize = useColumnResize()

    const liveOffset = useCallback((offset: number) => {
        columnResize.updateOffset(templateId, offset)
    }, [columnResize, templateId])

    const finalOffset = useCallback((offset: number) => {
        const width = columnResize.width(templateId) + offset
        columnResize.updateWidth(templateId, width)
    }, [columnResize, templateId])

    const startResize = useResizable(liveOffset, finalOffset)

    return (
        <div
            className='HorizontalGrip'
            onDoubleClick={() => onAutoSizeColumn(templateId)}
            onMouseDown={startResize}
        />
    )
}

export default React.memo(HorizontalGrip)
